"use server";

import { revalidatePath } from "next/cache";
import {
  createAccessLink,
  createPendency,
  reopenPendency,
  resolvePendency,
  revokeAccessLink,
} from "@corr/db";
import { requireOrgContext } from "@/server/session";

export async function addPendency(
  processId: string,
  stageKey: string | null,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const ctx = await requireOrgContext();

  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 3) return { error: "Descreva a pendência." };

  await createPendency(ctx, {
    processId,
    stageKey,
    title,
    description: String(formData.get("description") ?? "").trim() || null,
  });

  revalidatePath(`/processos/${processId}`);
  revalidatePath("/pendencias");
  return {};
}

export async function togglePendency(
  processId: string,
  pendencyId: string,
  resolved: boolean,
): Promise<void> {
  const ctx = await requireOrgContext();
  if (resolved) await resolvePendency(ctx, pendencyId);
  else await reopenPendency(ctx, pendencyId);

  revalidatePath(`/processos/${processId}`);
  revalidatePath("/pendencias");
}

export async function generateAccessLink(
  processId: string,
  _prev: { token?: string; error?: string },
  formData: FormData,
): Promise<{ token?: string; error?: string }> {
  const ctx = await requireOrgContext();

  const label = String(formData.get("label") ?? "").trim();
  if (label.length < 3) return { error: "Informe para quem é o link." };

  const days = Number(formData.get("expiresInDays") ?? 30);

  const link = await createAccessLink(ctx, {
    processId,
    label,
    canUpload: formData.get("canUpload") === "on",
    expiresInDays: Number.isFinite(days) ? days : 30,
  });

  revalidatePath(`/processos/${processId}`);
  // O token em claro volta uma única vez: depois daqui só existe o hash.
  return { token: link.token };
}

export async function revokeLink(processId: string, linkId: string): Promise<void> {
  const ctx = await requireOrgContext();
  await revokeAccessLink(ctx, linkId);
  revalidatePath(`/processos/${processId}`);
}
