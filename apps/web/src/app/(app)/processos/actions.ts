"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  DomainError,
  OTHER_PARTICIPANT_ROLES,
  participantRoleSchema,
  processCreateSchema,
  processStatusSchema,
} from "@corr/core";
import {
  addProcessParticipant,
  createProcessWithParticipants,
  moveProcessToStep,
  removeProcessParticipant,
  setProcessStatus,
} from "@corr/db";

const participantChoiceSchema = z.enum(["proponente", ...OTHER_PARTICIPANT_ROLES]);
import { requireOrgContext } from "@/server/session";

export interface ProcessFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Abre o processo com modalidade e participantes. A edição posterior
 * acontece por etapa, em `saveStageFields`, que é o caminho que gera histórico.
 */
export async function createProcessAction(
  _prev: ProcessFormState,
  formData: FormData,
): Promise<ProcessFormState> {
  const ctx = await requireOrgContext();

  const NEW = "__novo__";
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  const roles = formData.getAll("participantRole").map(String);
  const people = formData.getAll("participantPersonId").map(String);

  const parsed = processCreateSchema.safeParse({
    modality: text("modality") || undefined,
    proponentIds: formData.getAll("proponentIds").map(String).filter(Boolean),
    participants: roles
      .map((role, index) => ({ role, personId: people[index] ?? "" }))
      .filter((row) => row.personId !== ""),
    brokerId: text("brokerId") === NEW ? "" : text("brokerId"),
    newBrokerName: text("brokerId") === NEW ? text("newBrokerName") : "",
    realEstateAgencyId: text("realEstateAgencyId") === NEW ? "" : text("realEstateAgencyId"),
    newRealEstateAgencyName:
      text("realEstateAgencyId") === NEW ? text("newRealEstateAgencyName") : "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = String(issue.path[0] ?? "");
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { error: "Revise os campos destacados.", fieldErrors };
  }

  let savedId: string;
  try {
    const saved = await createProcessWithParticipants(ctx, parsed.data);
    savedId = saved.id;
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }

  revalidatePath("/processos");
  redirect(`/processos/${savedId}`);
}

export async function addParticipantAction(
  processId: string,
  personId: string,
  choice: string,
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  const parsed = participantChoiceSchema.safeParse(choice);
  if (!parsed.success || !personId) return { error: "Escolha a pessoa e o papel." };
  await addProcessParticipant(ctx, processId, personId, parsed.data);
  revalidatePath(`/processos/${processId}`);
  return {};
}

export async function removeParticipantAction(
  processId: string,
  personId: string,
  role: string,
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  const parsed = participantRoleSchema.safeParse(role);
  if (!parsed.success) return { error: "Papel inválido." };
  try {
    await removeProcessParticipant(ctx, processId, personId, parsed.data);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/processos/${processId}`);
  return {};
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
