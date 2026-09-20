import { type OrgContext, type OrgRole, ForbiddenError, NotFoundError, roleAtLeast } from "@corr/core";
import { and, eq } from "drizzle-orm";
import { getAdminDb, withOrg } from "../client";
import { orgCounters, orgMembers, orgs, profiles } from "../schema/orgs";

export interface MembershipSummary {
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: OrgRole;
}

/**
 * Escritórios de um usuário. Roda fora de tenant (é justamente o que decide
 * qual tenant usar), então filtra por `userId` explicitamente.
 */
export async function listMembershipsForUser(userId: string): Promise<MembershipSummary[]> {
  const rows = await getAdminDb()
    .select({
      orgId: orgs.id,
      orgName: orgs.name,
      orgSlug: orgs.slug,
      role: orgMembers.role,
    })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgs.id, orgMembers.orgId))
    .where(eq(orgMembers.userId, userId))
    .orderBy(orgs.name);

  return rows;
}

/** Carrega o vínculo de um usuário num escritório específico, ou `null`. */
export async function findMembership(userId: string, orgId: string): Promise<MembershipSummary | null> {
  const [row] = await getAdminDb()
    .select({
      orgId: orgs.id,
      orgName: orgs.name,
      orgSlug: orgs.slug,
      role: orgMembers.role,
    })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgs.id, orgMembers.orgId))
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)))
    .limit(1);

  return row ?? null;
}

export async function getOrg(ctx: OrgContext) {
  return withOrg(ctx, async (tx) => {
    const [org] = await tx.select().from(orgs).where(eq(orgs.id, ctx.orgId)).limit(1);
    if (!org) throw new NotFoundError("Escritório");
    return org;
  });
}

export type OrgProfileUpdate = Partial<{
  name: string;
  cnpj: string | null;
  internalCode: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  addressLine: string | null;
  logoPath: string | null;
}>;

export async function updateOrg(ctx: OrgContext, patch: OrgProfileUpdate) {
  if (!roleAtLeast(ctx.role, "admin")) {
    throw new ForbiddenError("Só administradores podem alterar os dados do escritório.");
  }
  return withOrg(ctx, async (tx) => {
    const [updated] = await tx
      .update(orgs)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(orgs.id, ctx.orgId))
      .returning();
    if (!updated) throw new NotFoundError("Escritório");
    return updated;
  });
}

export async function listOrgMembers(ctx: OrgContext) {
  return withOrg(ctx, async (tx) => {
    return tx
      .select({
        userId: profiles.id,
        fullName: profiles.fullName,
        email: profiles.email,
        role: orgMembers.role,
        joinedAt: orgMembers.createdAt,
      })
      .from(orgMembers)
      .innerJoin(profiles, eq(profiles.id, orgMembers.userId))
      .where(eq(orgMembers.orgId, ctx.orgId))
      .orderBy(profiles.fullName);
  });
}

/**
 * Cria escritório e já vincula quem criou como `owner`. Roda em conexão
 * administrativa porque, no momento do signup, o usuário ainda não pertence a
 * nenhum tenant — não há `app.org_id` para a RLS avaliar.
 */
export async function createOrgWithOwner(input: {
  name: string;
  slug: string;
  cnpj?: string | null;
  ownerUserId: string;
}) {
  return getAdminDb().transaction(async (tx) => {
    const [org] = await tx
      .insert(orgs)
      .values({ name: input.name, slug: input.slug, cnpj: input.cnpj ?? null })
      .returning();
    if (!org) throw new Error("Falha ao criar escritório.");

    await tx.insert(orgMembers).values({
      orgId: org.id,
      userId: input.ownerUserId,
      role: "owner",
    });

    // Contador de numeração de processos: criado junto para o primeiro cadastro
    // não depender de um caminho de inicialização preguiçosa.
    await tx.insert(orgCounters).values({ orgId: org.id }).onConflictDoNothing();

    return org;
  });
}
