"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { findMembership } from "@corr/db";
import { ForbiddenError } from "@corr/core";
import { requireSessionUser, ACTIVE_ORG_COOKIE } from "@/server/session";

/** Troca o escritório ativo. O vínculo é reconferido no banco antes de gravar. */
export async function setActiveOrg(orgId: string): Promise<void> {
  const user = await requireSessionUser();
  const membership = await findMembership(user.id, orgId);
  if (!membership) throw new ForbiddenError("Você não tem acesso a este escritório.");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
}
