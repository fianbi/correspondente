"use server";

import { revalidatePath } from "next/cache";
import {
  DomainError,
  documentStatusSchema,
  documentTypeSchema,
  type DocumentType,
} from "@corr/core";
import {
  deleteDocument,
  getDocument,
  getPerson,
  getProcess,
  registerDocument,
  reviewDocument,
  updateDocumentDetails,
} from "@corr/db";
import { requireOrgContext } from "@/server/session";
import {
  assertUploaded,
  createDownloadUrl,
  createUploadTarget,
  removeStoredFile,
  storageFolder,
} from "@/server/storage";

/**
 * Ações de documento, as mesmas na tela do processo e na da pessoa.
 *
 * Documento nunca fica solto: ou é de um processo, ou de uma pessoa, ou dos
 * dois (o RG do proponente enviado dentro do processo).
 */
export interface DocumentOwner {
  processId?: string | null;
  personId?: string | null;
}

export interface UploadTicket {
  path: string;
  signedUrl: string;
  token: string;
}

/**
 * Confere que o dono existe no escritório e, quando vêm os dois, que a pessoa
 * participa do processo. A RLS já impede ver outro escritório; isto impede
 * pendurar o documento na pessoa errada.
 */
async function resolveOwner(owner: DocumentOwner) {
  const ctx = await requireOrgContext();
  const processId = owner.processId || null;
  const personId = owner.personId || null;
  if (!processId && !personId) {
    throw new DomainError("Escolha a pessoa ou o processo do documento.", "missing_owner");
  }
  if (processId) {
    const process = await getProcess(ctx, processId);
    if (personId && !process.participants.some((p) => p.personId === personId)) {
      throw new DomainError("Essa pessoa não participa do processo.", "invalid_owner");
    }
  } else if (personId) {
    await getPerson(ctx, personId);
  }
  return { ctx, processId, personId };
}

function revalidateOwner(owner: { processId: string | null; personId: string | null }) {
  if (owner.processId) revalidatePath(`/processos/${owner.processId}`);
  if (owner.personId) revalidatePath(`/pessoas/${owner.personId}`);
  // Um documento pessoal aparece em todo processo da pessoa.
  revalidatePath("/processos/[id]", "page");
}

/**
 * Passo 1 do envio: o servidor decide o caminho e assina a permissão.
 *
 * Quem escolhe o caminho é sempre o servidor — se o cliente pudesse mandar o
 * path, escreveria na pasta de outro escritório.
 */
export async function prepareDocumentUpload(
  owner: DocumentOwner,
  file: { name: string; type: string; size: number },
): Promise<{ ticket?: UploadTicket; error?: string }> {
  try {
    const { ctx, processId, personId } = await resolveOwner(owner);
    const ticket = await createUploadTarget(
      ctx.orgId,
      storageFolder({ processId, personId }),
      file.name,
      file.type,
      file.size,
    );
    return { ticket };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

/** Passo 2: confere que o arquivo chegou e registra os metadados. */
export async function confirmDocumentUpload(input: {
  owner: DocumentOwner;
  path: string;
  title: string;
  type: string;
  stageKey?: string | null;
}): Promise<{ error?: string }> {
  const type = documentTypeSchema.safeParse(input.type);
  if (!type.success) return { error: "Tipo de documento inválido." };

  try {
    const { ctx, processId, personId } = await resolveOwner(input.owner);
    if (!input.path.startsWith(`${ctx.orgId}/${storageFolder({ processId, personId })}/`)) {
      return { error: "Caminho de arquivo inválido." };
    }

    const file = await assertUploaded(input.path);
    await registerDocument(ctx, {
      processId,
      personId,
      type: type.data as DocumentType,
      title: input.title.trim() || "Documento",
      storagePath: input.path,
      mimeType: file.mimeType,
      sizeBytes: file.size,
      stageKey: processId ? (input.stageKey ?? null) : null,
      source: "interno",
    });
    revalidateOwner({ processId, personId });
    return {};
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

/** URL de leitura temporária: o bucket é privado, não existe link fixo. */
export async function getDocumentUrl(documentId: string): Promise<string> {
  const ctx = await requireOrgContext();
  const document = await getDocument(ctx, documentId);
  return createDownloadUrl(document.storagePath);
}

export async function setDocumentStatus(
  documentId: string,
  status: string,
  notes?: string | null,
): Promise<void> {
  const ctx = await requireOrgContext();
  const parsed = documentStatusSchema.safeParse(status);
  if (!parsed.success) throw new DomainError("Status inválido.", "invalid_status");

  const updated = await reviewDocument(ctx, documentId, parsed.data, notes?.trim() || null);
  revalidateOwner({ processId: updated.processId, personId: updated.personId });
}

export async function editDocument(
  documentId: string,
  input: { type: string; personId: string | null },
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  const type = documentTypeSchema.safeParse(input.type);
  if (!type.success) return { error: "Tipo de documento inválido." };

  const current = await getDocument(ctx, documentId);
  try {
    if (current.processId && input.personId) {
      await resolveOwner({ processId: current.processId, personId: input.personId });
    }
    // Sem processo, o documento só existe pela pessoa: não dá para tirar o dono.
    if (!current.processId && !input.personId) {
      return { error: "Documento do cadastro precisa continuar com a pessoa." };
    }
    await updateDocumentDetails(ctx, documentId, { type: type.data, personId: input.personId });
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }

  revalidateOwner({ processId: current.processId, personId: current.personId });
  if (input.personId && input.personId !== current.personId) {
    revalidatePath(`/pessoas/${input.personId}`);
  }
  return {};
}

export async function removeDocument(documentId: string): Promise<void> {
  const ctx = await requireOrgContext();
  const current = await getDocument(ctx, documentId);
  const { storagePath } = await deleteDocument(ctx, documentId);
  // A linha sai primeiro: se o arquivo ficar órfão no bucket é desperdício de
  // espaço, mas metadado apontando para arquivo inexistente seria erro na tela.
  await removeStoredFile(storagePath);
  revalidateOwner({ processId: current.processId, personId: current.personId });
}
