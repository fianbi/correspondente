"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, simulationInputSchema } from "@corr/core";
import { createSimulation, deleteSimulation, updateSimulation } from "@corr/db";
import { requireOrgContext } from "@/server/session";

export interface SimulationFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  saved?: boolean;
}

/**
 * Lê o formulário da simulação. Os cenários chegam como colunas paralelas
 * (`scenarioFinanced`, `scenarioTerm`…), uma posição por linha da tabela.
 */
function readForm(formData: FormData) {
  const all = (key: string) => formData.getAll(key).map(String);
  const financed = all("scenarioFinanced");
  const chosen = formData.get("scenarioChosen");

  return {
    clientName: formData.get("clientName"),
    clientPhone: formData.get("clientPhone"),
    oldestBirthDate: formData.get("oldestBirthDate"),
    familyIncomeCents: formData.get("familyIncomeCents"),
    fgtsThreeYears: formData.get("fgtsThreeYears") ?? "",
    multipleBuyers: formData.get("multipleBuyers") ?? "",
    propertyValueCents: formData.get("propertyValueCents"),
    hadSubsidy: formData.get("hadSubsidy") ?? "",
    ownsProperty: formData.get("ownsProperty") ?? "",
    notes: formData.get("notes"),
    scenarios: financed.map((value, index) => ({
      financedValueCents: value,
      termMonths: all("scenarioTerm")[index],
      amortization: all("scenarioAmortization")[index],
      interestRate: all("scenarioRate")[index],
      firstInstallmentCents: all("scenarioInstallment")[index],
      subsidyCents: all("scenarioSubsidy")[index],
      chosen: chosen === String(index),
    })),
  };
}

export async function saveSimulation(
  simulationId: string | null,
  _prev: SimulationFormState,
  formData: FormData,
): Promise<SimulationFormState> {
  const ctx = await requireOrgContext();

  const parsed = simulationInputSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = String(issue.path[0] ?? "");
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { error: "Revise os campos destacados.", fieldErrors };
  }

  let id = simulationId;
  try {
    if (id) await updateSimulation(ctx, id, parsed.data);
    else id = (await createSimulation(ctx, parsed.data)).id;
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }

  revalidatePath("/simulacoes");
  if (!simulationId) redirect(`/simulacoes/${id}`);
  revalidatePath(`/simulacoes/${id}`);
  return { saved: true };
}

export async function deleteSimulationAction(simulationId: string): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  try {
    await deleteSimulation(ctx, simulationId);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  revalidatePath("/simulacoes");
  redirect("/simulacoes");
}
