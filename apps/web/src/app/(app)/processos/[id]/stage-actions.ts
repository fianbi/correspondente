"use server";

import { revalidatePath } from "next/cache";
import { DomainError, parseFieldPatch } from "@corr/core";
import {
  applyProcessPatch,
  assignStage,
  getFlowForProcess,
  getProcess,
} from "@corr/db";
import { requireOrgContext } from "@/server/session";

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
  _prev: StageFormState,
  formData: FormData,
): Promise<StageFormState> {
  const ctx = await requireOrgContext();

  const process = await getProcess(ctx, processId);
  const flow = await getFlowForProcess(ctx, process.flowId);
  const stage = flow.stages.find((s) => s.key === stageKey);
  if (!stage) return { error: "Etapa não encontrada neste fluxo." };

  const allowedKeys = stage.blocks.flatMap((block) => block.fields);
  const { values, errors } = parseFieldPatch(Object.fromEntries(formData), allowedKeys);

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
