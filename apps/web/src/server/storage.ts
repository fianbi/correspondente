import "server-only";

import { randomUUID } from "node:crypto";
import { DomainError, MAX_UPLOAD_BYTES, isAcceptedUpload } from "@corr/core";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const DOCUMENTS_BUCKET = "documentos";

/**
 * Caminho do arquivo no bucket.
 *
 * Começa pelo id do escritório para que o dado de cada um fique em prefixos
 * separados, e usa um uuid no nome para dois envios do mesmo arquivo não se
 * sobrescreverem.
 */
export function buildStoragePath(orgId: string, processId: string, fileName: string): string {
  const safeName = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-80);

  return `${orgId}/${processId}/${randomUUID()}-${safeName}`;
}

export interface UploadTarget {
  path: string;
  signedUrl: string;
  token: string;
}

/**
 * Emite uma URL assinada para o navegador subir o arquivo direto no Storage.
 *
 * O arquivo não passa pelo servidor do app: um PDF de 15 MB estouraria o
 * limite de corpo das server actions e ainda ocuparia memória do processo à
 * toa.
 */
export async function createUploadTarget(
  orgId: string,
  processId: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number,
): Promise<UploadTarget> {
  if (!isAcceptedUpload(mimeType)) {
    throw new DomainError("Formato não aceito. Envie PDF ou imagem.", "invalid_mime");
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    throw new DomainError("Arquivo acima de 20 MB.", "file_too_large");
  }

  const path = buildStoragePath(orgId, processId, fileName);
  const { data, error } = await getSupabaseAdmin()
    .storage.from(DOCUMENTS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new DomainError("Não foi possível preparar o envio do arquivo.", "storage_error", 502);
  }

  return { path: data.path, signedUrl: data.signedUrl, token: data.token };
}

/** URL de leitura de curta duração. O bucket é privado; não há link permanente. */
export async function createDownloadUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) {
    throw new DomainError("Não foi possível abrir o arquivo.", "storage_error", 502);
  }
  return data.signedUrl;
}

export async function removeStoredFile(path: string): Promise<void> {
  await getSupabaseAdmin().storage.from(DOCUMENTS_BUCKET).remove([path]);
}

/** Confere que o arquivo realmente chegou antes de registrar o documento. */
export async function assertUploaded(path: string): Promise<{ size: number; mimeType: string }> {
  const folder = path.slice(0, path.lastIndexOf("/"));
  const name = path.slice(path.lastIndexOf("/") + 1);

  const { data, error } = await getSupabaseAdmin()
    .storage.from(DOCUMENTS_BUCKET)
    .list(folder, { search: name, limit: 1 });

  const found = data?.[0];
  if (error || !found) {
    throw new DomainError("O arquivo não chegou ao armazenamento.", "upload_missing");
  }

  const metadata = found.metadata as { size?: number; mimetype?: string } | null;
  return {
    size: metadata?.size ?? 0,
    mimeType: metadata?.mimetype ?? "application/octet-stream",
  };
}
