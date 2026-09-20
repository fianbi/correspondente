"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DomainError, isValidCnpj, onlyDigits } from "@corr/core";
import { updateOrg } from "@corr/db";
import { requireOrgContext } from "@/server/session";

export interface OrgSettingsState {
  error?: string;
  saved?: boolean;
}

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value));

const schema = z.object({
  name: z.string().trim().min(3, "Informe o nome do escritório."),
  cnpj: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : onlyDigits(value)))
    .refine((value) => value === null || isValidCnpj(value), "CNPJ inválido."),
  internalCode: optionalText,
  email: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .refine((value) => value === null || z.string().email().safeParse(value).success, "E-mail inválido."),
  phone: optionalText,
  city: optionalText,
  addressLine: optionalText,
});

export async function saveOrgSettings(
  _prev: OrgSettingsState,
  formData: FormData,
): Promise<OrgSettingsState> {
  const ctx = await requireOrgContext();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await updateOrg(ctx, parsed.data);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }

  revalidatePath("/configuracoes/escritorio");
  return { saved: true };
}
