"use server";

import { revalidatePath } from "next/cache";
import {
  DomainError,
  documentStatusSchema,
  documentTypeSchema,
  type DocumentType,
} from "@corr/core";
import {
  createAccessLink,
  createPendency,
  deleteDocument,
  getDocument,
  registerDocument,
  reopenPendency,
  resolvePendency,
  revokeAccessLink,
  reviewDocument,
} from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { assertUploaded, createDownloadUrl, createUploadTarget, removeStoredFile } from "@/server/storage";

export interface UploadTicket {
  path: string;
  signedUrl: string;
  token: string;
}

/**
 * Passo 1 do envio: o servidor decide o caminho e assina a permissão.
 *
 * Quem escolhe o caminho é sempre o servidor — se o cliente pudesse mandar o
 * path, escreveria na pasta de outro escritório.
 */
export async function prepareUpload(
  processId: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number,
): Promise<{ ticket?: UploadTicket; error?: string }> {
  const ctx = await requireOrgContext();
  try {
    const ticket = await createUploadTarget(ctx.orgId, processId, fileName, mimeType, sizeBytes);
    return { ticket };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

/** Passo 2: confere que o arquivo chegou e registra os metadados. */
export async function confirmUpload(input: {
  processId: string;
  path: string;
  title: string;
  type: string;
  stageKey?: string | null;
}): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();

  const type = documentTypeSchema.safeParse(input.type);
  if (!type.success) return { error: "Tipo de documento inválido." };
  if (!input.path.startsWith(`${ctx.orgId}/${input.processId}/`)) {
    return { error: "Caminho de arquivo inválido." };
  }

  try {
    const file = await assertUploaded(input.path);
    await registerDocument(ctx, {
      processId: input.processId,
      type: type.data as DocumentType,
      title: input.title.trim() || "Documento",
      storagePath: input.path,
      mimeType: file.mimeType,
      sizeBytes: file.size,
      stageKey: input.stageKey ?? null,
      source: "interno",
    });
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }

  revalidatePath(`/processos/${input.processId}`);
  revalidatePath("/documentos");
  return {};
}

/** URL de leitura temporária: o bucket é privado, não existe link fixo. */
export async function getDocumentUrl(documentId: string): Promise<string> {
  const ctx = await requireOrgContext();
  const document = await getDocument(ctx, documentId);
  return createDownloadUrl(document.storagePath);
}

export async function setDocumentStatus(
  processId: string,
  documentId: string,
  status: string,
): Promise<void> {
  const ctx = await requireOrgContext();
  const parsed = documentStatusSchema.safeParse(status);
  if (!parsed.success) throw new DomainError("Status inválido.", "invalid_status");

  await reviewDocument(ctx, documentId, parsed.data);
  revalidatePath(`/processos/${processId}`);
  revalidatePath("/documentos");
}

export async function removeDocument(processId: string, documentId: string): Promise<void> {
  const ctx = await requireOrgContext();
  const { storagePath } = await deleteDocument(ctx, documentId);
  // A linha sai primeiro: se o arquivo ficar órfão no bucket é desperdício de
  // espaço, mas metadado apontando para arquivo inexistente seria erro na tela.
  await removeStoredFile(storagePath);

  revalidatePath(`/processos/${processId}`);
  revalidatePath("/documentos");
}

export async function addPendency(
  processId: string,
  stageKey: string | null,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();

  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 3) return { error: "Descreva a pendência." };

  await createPendency(ctx, {
    processId,
    stageKey,
    title,
    description: String(formData.get("description") ?? "").trim() || null,
  });

  revalidatePath(`/processos/${processId}`);
  revalidatePath("/pendencias");
  return {};
}

export async function togglePendency(
  processId: string,
  pendencyId: string,
  resolved: boolean,
): Promise<void> {
  const ctx = await requireOrgContext();
  if (resolved) await resolvePendency(ctx, pendencyId);
  else await reopenPendency(ctx, pendencyId);

  revalidatePath(`/processos/${processId}`);
  revalidatePath("/pendencias");
}

export async function generateAccessLink(
  processId: string,
  _prev: { token?: string; error?: string },
  formData: FormData,
): Promise<{ token?: string; error?: string }> {
  const ctx = await requireOrgContext();

  const label = String(formData.get("label") ?? "").trim();
  if (label.length < 3) return { error: "Informe para quem é o link." };

  const days = Number(formData.get("expiresInDays") ?? 30);

  const link = await createAccessLink(ctx, {
    processId,
    label,
    canUpload: formData.get("canUpload") === "on",
    expiresInDays: Number.isFinite(days) ? days : 30,
  });

  revalidatePath(`/processos/${processId}`);
  // O token em claro volta uma única vez: depois daqui só existe o hash.
  return { token: link.token };
}

export async function revokeLink(processId: string, linkId: string): Promise<void> {
  const ctx = await requireOrgContext();
  await revokeAccessLink(ctx, linkId);
  revalidatePath(`/processos/${processId}`);
}
