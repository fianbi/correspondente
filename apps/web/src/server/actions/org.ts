"use server";

import { revalidatePath } from "next/cache";
import { findMembership } from "@corr/db";
import { ForbiddenError } from "@corr/core";
import { gravarEscritorioAtivo, requireSessionUser } from "@/server/session";

/** Troca o escritório ativo. O vínculo é reconferido no banco antes de gravar. */
export async function setActiveOrg(orgId: string): Promise<void> {
  const user = await requireSessionUser();
  const membership = await findMembership(user.id, orgId);
  if (!membership) throw new ForbiddenError("Você não tem acesso a este escritório.");

  await gravarEscritorioAtivo(orgId);

  revalidatePath("/", "layout");
}
