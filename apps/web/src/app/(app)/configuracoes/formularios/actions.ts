"use server";

import { revalidatePath } from "next/cache";
import { DomainError } from "@corr/core";
import { createFormTemplate, deleteFormTemplate, updateFormTemplateMap } from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DOCUMENTS_BUCKET, removeStoredFile } from "@/server/storage";
import { detectarCampos } from "@/server/pdf/formulario";
import { getModeloPronto } from "@/server/pdf/modelos";

export interface TemplateState {
  error?: string;
  ok?: string;
}

/**
 * Recebe o PDF em branco do banco e descobre quais campos ele tem.
 *
 * O arquivo vem pelo formulário porque modelo de formulário é pequeno (poucas
 * páginas) e chega uma vez só — diferente dos documentos de cliente, que sobem
 * direto para o armazenamento.
 */
export async function uploadTemplate(
  _prev: TemplateState,
  formData: FormData,
): Promise<TemplateState> {
  const ctx = await requireOrgContext();

  const nome = String(formData.get("name") ?? "").trim();
  const arquivo = formData.get("file");

  if (nome.length < 3) return { error: "Dê um nome ao modelo." };
  if (!(arquivo instanceof File) || arquivo.size === 0) return { error: "Selecione o PDF do modelo." };
  if (/\.(dot|dotx|doc|docx)$/i.test(arquivo.name)) {
    return {
      error:
        "Modelo do Word ainda não é lido aqui. Se for um formulário da Caixa, veja em Modelos prontos; senão, exporte como PDF com campos.",
    };
  }
  if (arquivo.type !== "application/pdf") return { error: "O modelo precisa ser um PDF." };

  const bytes = await arquivo.arrayBuffer();

  let campos: string[];
  try {
    campos = await detectarCampos(bytes);
  } catch {
    return { error: "Não foi possível ler este PDF." };
  }

  if (campos.length === 0) {
    return {
      error:
        "Este PDF não tem campos de formulário preenchíveis. Peça ao banco a versão editável.",
    };
  }

  const caminho = `${ctx.orgId}/modelos/${crypto.randomUUID()}.pdf`;
  const { error } = await getSupabaseAdmin()
    .storage.from(DOCUMENTS_BUCKET)
    .upload(caminho, bytes, { contentType: "application/pdf" });

  if (error) return { error: "Falha ao guardar o modelo." };

  await createFormTemplate(ctx, {
    name: nome,
    description: String(formData.get("description") ?? "").trim() || null,
    storagePath: caminho,
    detectedFields: campos,
  });

  revalidatePath("/configuracoes/formularios");
  return { ok: `Modelo salvo com ${campos.length} campo(s) detectado(s).` };
}

/** Adiciona ao escritório um dos modelos que o sistema já traz mapeados. */
export async function addReadyTemplate(chave: string): Promise<TemplateState> {
  const ctx = await requireOrgContext();
  const modelo = getModeloPronto(chave);
  if (!modelo) return { error: "Modelo pronto não encontrado." };

  const bytes = modelo.pdf();
  const campos = await detectarCampos(bytes.slice().buffer);

  const caminho = `${ctx.orgId}/modelos/${crypto.randomUUID()}.pdf`;
  const { error } = await getSupabaseAdmin()
    .storage.from(DOCUMENTS_BUCKET)
    .upload(caminho, bytes, { contentType: "application/pdf" });

  if (error) return { error: "Falha ao guardar o modelo." };

  const criado = await createFormTemplate(ctx, {
    name: modelo.nome,
    description: modelo.descricao,
    storagePath: caminho,
    detectedFields: campos,
  });
  await updateFormTemplateMap(ctx, criado.id, modelo.fieldMap);

  revalidatePath("/configuracoes/formularios");
  return { ok: `${modelo.nome} adicionado.` };
}

/** Salva o de-para entre os campos do PDF e as chaves do catálogo. */
export async function saveFieldMap(
  templateId: string,
  _prev: TemplateState,
  formData: FormData,
): Promise<TemplateState> {
  const ctx = await requireOrgContext();

  const fieldMap: Record<string, string> = {};
  for (const [chave, valor] of formData.entries()) {
    if (!chave.startsWith("campo:")) continue;
    const destino = String(valor).trim();
    if (destino) fieldMap[chave.slice("campo:".length)] = destino;
  }

  try {
    await updateFormTemplateMap(ctx, templateId, fieldMap);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }

  revalidatePath("/configuracoes/formularios");
  return { ok: `${Object.keys(fieldMap).length} campo(s) mapeado(s).` };
}

export async function removeTemplate(templateId: string): Promise<void> {
  const ctx = await requireOrgContext();
  const { storagePath } = await deleteFormTemplate(ctx, templateId);
  await removeStoredFile(storagePath);
  revalidatePath("/configuracoes/formularios");
}
