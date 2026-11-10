"use server";

import { revalidatePath } from "next/cache";
import { DomainError } from "@corr/core";
import {
  createFormTemplate,
  deleteFormTemplate,
  listFormTemplates,
  updateFormTemplateInfo,
  updateFormTemplateMap,
} from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DOCUMENTS_BUCKET, removeStoredFile } from "@/server/storage";
import { detectarCampos } from "@/server/pdf/formulario";
import { getModeloPronto, origemPronta } from "@/server/pdf/modelos";

export interface TemplateState {
  error?: string;
  ok?: string;
}

/** Adiciona ao escritório um dos modelos que o sistema já traz mapeados. */
export async function addReadyTemplate(chave: string): Promise<TemplateState> {
  const ctx = await requireOrgContext();
  const modelo = getModeloPronto(chave);
  if (!modelo) return { error: "Modelo pronto não encontrado." };
  const fieldMap = { ...modelo.fieldMap, "#pronto": modelo.chave };

  // Já adicionado: atualiza o mapeamento para o mais novo, mantendo nome e
  // descrição que o escritório deu.
  const existente = (await listFormTemplates(ctx)).find(
    (template) => origemPronta(template)?.chave === modelo.chave,
  );
  if (existente) {
    await updateFormTemplateMap(ctx, existente.id, fieldMap);
    revalidatePath("/configuracoes/formularios");
    return { ok: `Mapeamento de ${existente.name} atualizado.` };
  }

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
  await updateFormTemplateMap(ctx, criado.id, fieldMap);

  revalidatePath("/configuracoes/formularios");
  return { ok: `${modelo.nome} adicionado.` };
}

/** Nome e descrição do modelo. Os campos de cada modelo vêm prontos do sistema. */
export async function saveTemplateInfo(
  templateId: string,
  _prev: TemplateState,
  formData: FormData,
): Promise<TemplateState> {
  const ctx = await requireOrgContext();

  const nome = String(formData.get("name") ?? "").trim();
  if (nome.length < 3) return { error: "Dê um nome ao modelo." };
  const descricao = String(formData.get("description") ?? "").trim() || null;

  try {
    await updateFormTemplateInfo(ctx, templateId, { name: nome, description: descricao });
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }

  revalidatePath("/configuracoes/formularios");
  return { ok: "Salvo." };
}

export async function removeTemplate(templateId: string): Promise<void> {
  const ctx = await requireOrgContext();
  const { storagePath } = await deleteFormTemplate(ctx, templateId);
  await removeStoredFile(storagePath);
  revalidatePath("/configuracoes/formularios");
}
