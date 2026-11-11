"use server";

import { redirect } from "next/navigation";
import { DomainError } from "@corr/core";
import { acceptInvite } from "@corr/db";
import { gravarEscritorioAtivo, requireSessionUser } from "@/server/session";

/** Aceita o convite e já abre o sistema no escritório que convidou. */
export async function aceitarConvite(token: string): Promise<{ error?: string }> {
  const user = await requireSessionUser();
  let orgId: string;
  try {
    ({ orgId } = await acceptInvite(token, { id: user.id, email: user.email }));
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  await gravarEscritorioAtivo(orgId);
  redirect("/painel");
}
