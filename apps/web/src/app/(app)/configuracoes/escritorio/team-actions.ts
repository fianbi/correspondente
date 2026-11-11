"use server";

import { revalidatePath } from "next/cache";
import { DomainError, orgRoleSchema } from "@corr/core";
import { createInvite, removeMember, revokeInvite, updateMemberRole } from "@corr/db";
import { z } from "zod";
import { requireOrgContext } from "@/server/session";

const PAGINA = "/configuracoes/escritorio";

export interface InviteState {
  token?: string;
  email?: string;
  error?: string;
}

/** Gera o convite. O token em claro volta uma única vez; o banco guarda o hash. */
export async function inviteMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const ctx = await requireOrgContext();
  const email = z.string().trim().email().safeParse(formData.get("inviteEmail"));
  if (!email.success) return { error: "Informe um e-mail válido." };
  const role = orgRoleSchema.safeParse(formData.get("inviteRole"));
  if (!role.success) return { error: "Escolha o papel." };

  try {
    const convite = await createInvite(ctx, { email: email.data, role: role.data });
    revalidatePath(PAGINA);
    return { token: convite.token, email: email.data.toLowerCase() };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

export async function cancelInvite(inviteId: string): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  try {
    await revokeInvite(ctx, inviteId);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  revalidatePath(PAGINA);
  return {};
}

export async function changeMemberRole(userId: string, role: string): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  const parsed = orgRoleSchema.safeParse(role);
  if (!parsed.success) return { error: "Papel inválido." };
  try {
    await updateMemberRole(ctx, userId, parsed.data);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  revalidatePath(PAGINA);
  return {};
}

export async function removeTeamMember(userId: string): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();
  try {
    await removeMember(ctx, userId);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  revalidatePath(PAGINA);
  return {};
}
