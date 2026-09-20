import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { OrgContext } from "@corr/core";
import { getAdminDb } from "../client";
import { orgCounters, orgMembers, orgs } from "../schema/orgs";

/**
 * Apoio para as suítes `*.db.test.ts`. Cria escritórios isolados de verdade no
 * Postgres local — os testes de tenancy não valeriam nada contra mock.
 */

export interface TestOrg {
  ctx: OrgContext;
  orgId: string;
  userId: string;
}

const admin = getAdminDb();

export async function createTestOrg(label: string): Promise<TestOrg> {
  const suffix = randomUUID().slice(0, 8);
  const orgId = randomUUID();
  const userId = randomUUID();

  await admin.execute(
    sql`insert into auth.users (id, email) values (${userId}, ${`${label}-${suffix}@teste.local`}) on conflict (id) do nothing`,
  );

  await admin.insert(orgs).values({
    id: orgId,
    name: `Escritório ${label} ${suffix}`,
    slug: `org-${label}-${suffix}`,
  });
  await admin.insert(orgMembers).values({ orgId, userId, role: "owner" });
  await admin.insert(orgCounters).values({ orgId });

  return { orgId, userId, ctx: { orgId, userId, role: "owner" } };
}

export async function destroyTestOrg(org: TestOrg): Promise<void> {
  await admin.execute(sql`delete from public.orgs where id = ${org.orgId}`);
  await admin.execute(sql`delete from auth.users where id = ${org.userId}`);
}

/** CPFs fictícios válidos no dígito verificador, para não usar dado real. */
export const CPFS_VALIDOS = [
  "11144477735",
  "52998224725",
  "15350946056",
  "40364738081",
  "87512643071",
] as const;
