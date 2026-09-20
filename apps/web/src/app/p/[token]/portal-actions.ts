"use server";

import { revalidatePath } from "next/cache";
import { DomainError, documentTypeSchema } from "@corr/core";
import { registerPortalDocument, resolvePortalToken } from "@corr/db";
import { assertUploaded, createUploadTarget } from "@/server/storage";

/**
 * Toda ação do portal recomeça pelo token.
 *
 * Nada do que o formulário manda define escritório ou processo: eles saem
 * sempre do link, que é a única credencial que o visitante tem.
 */
async function requirePortalSession(token: string) {
  const session = await resolvePortalToken(token);
  if (!session) throw new DomainError("Link inválido ou expirado.", "invalid_token", 403);
  return session;
}

export async function preparePortalUpload(
  token: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number,
): Promise<{ ticket?: { path: string; signedUrl: string; token: string }; error?: string }> {
  try {
    const session = await requirePortalSession(token);
    if (!session.canUpload) return { error: "Este link é somente para acompanhamento." };

    const ticket = await createUploadTarget(
      session.orgId,
      session.processId,
      fileName,
      mimeType,
      sizeBytes,
    );
    return { ticket };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

export async function confirmPortalUpload(input: {
  token: string;
  path: string;
  title: string;
  type: string;
  senderName: string;
}): Promise<{ error?: string }> {
  try {
    const session = await requirePortalSession(input.token);

    const type = documentTypeSchema.safeParse(input.type);
    if (!type.success) return { error: "Selecione o tipo de documento." };
    if (!input.path.startsWith(`${session.orgId}/${session.processId}/`)) {
      return { error: "Caminho de arquivo inválido." };
    }

    const file = await assertUploaded(input.path);
    await registerPortalDocument(session, {
      type: type.data,
      title: input.title.trim() || "Documento",
      storagePath: input.path,
      mimeType: file.mimeType,
      sizeBytes: file.size,
      senderName: input.senderName.trim(),
    });
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }

  revalidatePath(`/p/${input.token}`);
  return {};
}
