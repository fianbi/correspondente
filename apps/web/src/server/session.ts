import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { OrgContext } from "@corr/core";
import { findMembership, listMembershipsForUser, type MembershipSummary } from "@corr/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const ACTIVE_ORG_COOKIE = "corr_org";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
}

/**
 * `cache` deduplica por requisição: layout, página e server actions chamam isso
 * à vontade e a validação do JWT acontece uma vez só.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const metadata = user.user_metadata as { full_name?: string } | null;
  return {
    id: user.id,
    email: user.email ?? "",
    fullName: metadata?.full_name?.trim() || user.email?.split("@")[0] || "Usuário",
  };
});

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export interface ActiveOrg extends OrgContext {
  orgName: string;
  orgSlug: string;
  memberships: MembershipSummary[];
}

/**
 * Resolve o escritório ativo da requisição. É o único lugar que monta um
 * `OrgContext` — repositórios exigem esse objeto, então nenhuma query de dados
 * roda sem passar por aqui e ter o vínculo do usuário conferido no banco.
 */
export const requireOrgContext = cache(async (): Promise<ActiveOrg> => {
  const user = await requireSessionUser();
  const memberships = await listMembershipsForUser(user.id);

  if (memberships.length === 0) redirect("/cadastro/escritorio");

  const cookieStore = await cookies();
  const requestedOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  // Cookie é dado do cliente: só vale depois de confirmar o vínculo no banco.
  const active = requestedOrgId
    ? ((await findMembership(user.id, requestedOrgId)) ?? memberships[0]!)
    : memberships[0]!;

  return {
    orgId: active.orgId,
    userId: user.id,
    role: active.role,
    orgName: active.orgName,
    orgSlug: active.orgSlug,
    memberships,
  };
});
