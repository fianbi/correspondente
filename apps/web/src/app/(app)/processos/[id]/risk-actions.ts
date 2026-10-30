"use server";

import { revalidatePath } from "next/cache";
import { DomainError } from "@corr/core";
import { linkRiskAssessment } from "@corr/db";
import { requireOrgContext } from "@/server/session";

/** Troca (ou tira) a avaliação de risco do processo. Erro de regra volta como texto. */
export async function linkRiskAssessmentAction(
  processId: string,
  assessmentId: string,
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  try {
    await linkRiskAssessment(ctx, processId, assessmentId === "" ? null : assessmentId);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/processos/${processId}`);
  return {};
}
