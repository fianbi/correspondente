"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, processInputSchema, processStageSchema, processStatusSchema } from "@corr/core";
import { createProcess, moveProcessToStage, setProcessStatus } from "@corr/db";
import { requireOrgContext } from "@/server/session";

export interface ProcessFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Cria o processo. A edição posterior acontece por etapa, em
 * `saveStageFields`, que é o caminho que gera histórico.
 */
export async function createProcessAction(
  _prev: ProcessFormState,
  formData: FormData,
): Promise<ProcessFormState> {
  const ctx = await requireOrgContext();

  const parsed = processInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { error: "Revise os campos destacados.", fieldErrors };
  }

  let savedId: string;
  try {
    const saved = await createProcess(ctx, parsed.data);
    savedId = saved.id;
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }

  revalidatePath("/processos");
  redirect(`/processos/${savedId}`);
}

/** Usada pelo seletor de fase do Kanban e da tela do processo. */
export async function moveStage(processId: string, stage: string): Promise<void> {
  const ctx = await requireOrgContext();
  const parsed = processStageSchema.safeParse(stage);
  if (!parsed.success) throw new DomainError("Fase inválida.", "invalid_stage");

  await moveProcessToStage(ctx, processId, parsed.data);
  revalidatePath("/processos");
  revalidatePath(`/processos/${processId}`);
}

export async function changeStatus(processId: string, status: string): Promise<void> {
  const ctx = await requireOrgContext();
  const parsed = processStatusSchema.safeParse(status);
  if (!parsed.success) throw new DomainError("Status inválido.", "invalid_status");

  await setProcessStatus(ctx, processId, parsed.data);
  revalidatePath("/processos");
  revalidatePath(`/processos/${processId}`);
}
