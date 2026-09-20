"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, personIncomeInputSchema, personInputSchema } from "@corr/core";
import {
  DuplicatePersonError,
  addPersonIncome,
  createPerson,
  deletePersonIncome,
  updatePerson,
} from "@corr/db";
import { requireOrgContext } from "@/server/session";

export interface PersonFormState {
  error?: string;
  /** Preenchido quando o CPF já existe: a UI oferece abrir o cadastro. */
  duplicatePersonId?: string;
  fieldErrors?: Record<string, string>;
}

export async function savePerson(
  personId: string | null,
  _prev: PersonFormState,
  formData: FormData,
): Promise<PersonFormState> {
  const ctx = await requireOrgContext();

  const parsed = personInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      error: "Revise os campos destacados.",
      fieldErrors,
    };
  }

  let savedId = personId;
  try {
    const saved = personId
      ? await updatePerson(ctx, personId, parsed.data)
      : await createPerson(ctx, parsed.data);
    savedId = saved.id;
  } catch (error) {
    if (error instanceof DuplicatePersonError) {
      return { error: error.message, duplicatePersonId: error.personId };
    }
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }

  revalidatePath("/pessoas");
  redirect(`/pessoas/${savedId}`);
}

export async function addIncome(
  personId: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();

  const parsed = personIncomeInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await addPersonIncome(ctx, personId, parsed.data);
  revalidatePath(`/pessoas/${personId}`);
  return {};
}

export async function removeIncome(personId: string, incomeId: string): Promise<void> {
  const ctx = await requireOrgContext();
  await deletePersonIncome(ctx, incomeId);
  revalidatePath(`/pessoas/${personId}`);
}
