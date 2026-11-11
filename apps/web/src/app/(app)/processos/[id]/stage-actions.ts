"use server";

import { revalidatePath } from "next/cache";
import { DomainError, parseFieldPatch, stepsForModality } from "@corr/core";
import {
  applyProcessPatch,
  assignStage,
  findOrCreateAgency,
  listBanks,
  getFlowForProcess,
  getProcess,
} from "@corr/db";
import { requireOrgContext } from "@/server/session";
import {
  CAMPO_CIDADE_AGENCIA_NOVA,
  CAMPO_NOME_AGENCIA_NOVA,
  NUMERO_AGENCIA,
} from "@/lib/agencias";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StageFormState {
  savedCount?: number;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Salva os campos de uma etapa.
 *
 * As chaves aceitas vêm da configuração do fluxo, não do formulário: um POST
 * forjado com outras chaves não consegue escrever campos de outra etapa.
 */
export async function saveStageFields(
  processId: string,
  stageKey: string,
  stepKey: string,
  _prev: StageFormState,
  formData: FormData,
): Promise<StageFormState> {
  const ctx = await requireOrgContext();

  const process = await getProcess(ctx, processId);
  const step = stepsForModality(process.modality).find((s) => s.key === stepKey);
  const flow = await getFlowForProcess(ctx, process.flowId);
  const stage = flow.stages.find((s) => s.key === stageKey);
  const blocks = step?.blocks ?? stage?.blocks;
  if (!blocks) return { error: "Etapa não encontrada neste fluxo." };

  const allowedKeys = blocks.flatMap((block) => block.fields);
  const entrada: Record<string, unknown> = Object.fromEntries(formData);

  // Agência: vem o id de uma do cadastro ou, se for nova, o número digitado
  // (com nome e cidade opcionais), que é cadastrada aqui mesmo. Banco: o do
  // formulário, o do processo ou, sem nenhum, a Caixa.
  const agencia =
    typeof entrada["process.agency"] === "string" ? entrada["process.agency"].trim() : "";
  if (allowedKeys.includes("process.agency") && agencia && !UUID.test(agencia)) {
    if (!NUMERO_AGENCIA.test(agencia)) {
      return {
        error: "Revise os campos destacados.",
        fieldErrors: {
          "process.agency":
            "Agência não encontrada no cadastro. Para cadastrar uma nova, digite o número dela.",
        },
      };
    }
    const bankId =
      (typeof entrada["process.bank"] === "string" && entrada["process.bank"]) ||
      process.bankId ||
      (await listBanks()).find((bank) => bank.code === "104")?.id;
    if (!bankId) return { error: "Escolha o banco antes de informar a agência." };
    const texto = (chave: string) => {
      const valor = entrada[chave];
      return typeof valor === "string" ? valor : null;
    };
    entrada["process.agency"] = await findOrCreateAgency(ctx, {
      bankId,
      number: agencia,
      name: texto(CAMPO_NOME_AGENCIA_NOVA),
      city: texto(CAMPO_CIDADE_AGENCIA_NOVA),
    });
  }

  const { values, errors } = parseFieldPatch(entrada, allowedKeys);

  if (Object.keys(errors).length > 0) {
    return { error: "Revise os campos destacados.", fieldErrors: errors };
  }

  try {
    const { changes } = await applyProcessPatch(ctx, processId, values);
    revalidatePath(`/processos/${processId}`);
    revalidatePath("/processos");
    return { savedCount: changes.length };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

export async function assignStageAction(
  processId: string,
  stageKey: string,
  userId: string,
): Promise<void> {
  const ctx = await requireOrgContext();
  await assignStage(ctx, processId, stageKey, userId === "" ? null : userId);
  revalidatePath(`/processos/${processId}`);
}
