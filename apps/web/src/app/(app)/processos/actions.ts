"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, processInputSchema, processStatusSchema } from "@corr/core";
import { createProcess, moveProcessToStep, setProcessStatus } from "@corr/db";
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

/** Move o processo para uma etapa do roteiro da modalidade dele. */
export async function moveStep(processId: string, stepKey: string): Promise<void> {
  const ctx = await requireOrgContext();
  await moveProcessToStep(ctx, processId, stepKey);
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
