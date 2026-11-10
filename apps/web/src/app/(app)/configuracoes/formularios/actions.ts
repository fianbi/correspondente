"use server";

import { revalidatePath } from "next/cache";
import { DomainError } from "@corr/core";
import {
  createFormTemplate,
  deleteFormTemplate,
  getFormTemplate,
  listFormTemplates,
  updateFormTemplateInfo,
  updateFormTemplateMap,
} from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DOCUMENTS_BUCKET, removeStoredFile } from "@/server/storage";
import { detectarCampos } from "@/server/pdf/formulario";
import { getModeloPronto, origemPronta } from "@/server/pdf/modelos";
import { ehChaveInterna, montarOpcao, PERGUNTAR_OPCAO } from "@/lib/formularios";

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

/**
 * Salva nome, descrição e o de-para entre os campos do PDF e as origens dos
 * valores (chave do catálogo ou pergunta na hora de gerar).
 */
export async function saveFieldMap(
  templateId: string,
  _prev: TemplateState,
  formData: FormData,
): Promise<TemplateState> {
  const ctx = await requireOrgContext();

  const nome = String(formData.get("name") ?? "").trim();
  if (nome.length < 3) return { error: "Dê um nome ao modelo." };
  const descricao = String(formData.get("description") ?? "").trim() || null;

  let atual: Record<string, string>;
  try {
    atual = (await getFormTemplate(ctx, templateId)).fieldMap;
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }

  // Chaves internas (#pronto, ordem das opções) não aparecem na tela e
  // continuam como estavam.
  const fieldMap: Record<string, string> = Object.fromEntries(
    Object.entries(atual).filter(([chave]) => ehChaveInterna(chave)),
  );

  for (const [chave, valor] of formData.entries()) {
    if (!chave.startsWith("campo:")) continue;
    const campo = chave.slice("campo:".length);
    let destino = String(valor).trim();

    if (destino === PERGUNTAR_OPCAO) {
      const grupo = String(formData.get(`grupo:${campo}`) ?? "").trim();
      const opcao = String(formData.get(`opcao:${campo}`) ?? "").trim();
      if (!grupo || !opcao) {
        return { error: `Em "${campo}", diga o grupo e o nome da opção.` };
      }
      destino = montarOpcao(grupo, opcao);
    }

    if (destino) fieldMap[campo] = destino;
  }

  try {
    await updateFormTemplateInfo(ctx, templateId, { name: nome, description: descricao });
    await updateFormTemplateMap(ctx, templateId, fieldMap);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }

  revalidatePath("/configuracoes/formularios");
  const mapeados = Object.keys(fieldMap).filter((chave) => !ehChaveInterna(chave)).length;
  return { ok: `Salvo: ${mapeados} campo(s) mapeado(s).` };
}

export async function removeTemplate(templateId: string): Promise<void> {
  const ctx = await requireOrgContext();
  const { storagePath } = await deleteFormTemplate(ctx, templateId);
  await removeStoredFile(storagePath);
  revalidatePath("/configuracoes/formularios");
}
