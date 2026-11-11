"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DomainError } from "@corr/core";
import { createAgency, deleteAgency, updateAgency } from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { NUMERO_AGENCIA } from "@/lib/agencias";

export interface AgencyFormState {
  error?: string;
  saved?: boolean;
}

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value));

const schema = z.object({
  bankId: z.string().uuid("Escolha o banco."),
  number: z
    .string()
    .trim()
    .regex(NUMERO_AGENCIA, "Informe o número da agência (só dígitos, ex.: 1234)."),
  name: z.string().trim().min(2, "Informe o nome da agência."),
  city: optionalText,
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .transform((value) => (value === "" ? null : value))
    .refine((value) => value === null || /^[A-Z]{2}$/.test(value), "UF com duas letras."),
  email: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .refine((value) => value === null || z.string().email().safeParse(value).success, "E-mail inválido."),
  phone: optionalText,
});

function revalidar() {
  revalidatePath("/configuracoes/agencias");
  revalidatePath("/processos", "layout");
}

/** Cadastra (sem `agencyId`) ou altera uma agência do escritório. */
export async function saveAgency(
  agencyId: string | null,
  _prev: AgencyFormState,
  formData: FormData,
): Promise<AgencyFormState> {
  const ctx = await requireOrgContext();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    if (agencyId) await updateAgency(ctx, agencyId, parsed.data);
    else await createAgency(ctx, parsed.data);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }

  revalidar();
  return { saved: true };
}

export async function removeAgency(agencyId: string): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  try {
    await deleteAgency(ctx, agencyId);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  revalidar();
  return {};
}
