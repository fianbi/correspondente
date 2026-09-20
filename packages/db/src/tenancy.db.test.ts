import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import type { OrgContext } from "@corr/core";
import { getAdminDb, getDb, withOrg } from "./client";
import { orgMembers, orgs, profiles } from "./schema/orgs";

/**
 * Isolamento entre escritórios — a suíte que não pode falhar nunca.
 *
 * Roda contra o Postgres local (`pnpm supabase start` + `pnpm db:migrate`) com a
 * DATABASE_URL apontando para `app_user`. Se algum dia alguém rodar a aplicação
 * com uma role privilegiada, os testes abaixo quebram, que é exatamente o aviso
 * que se quer ter.
 */

/** Códigos de erro do Postgres em toda a cadeia de `cause` de um erro. */
function pgErrorCodes(error: unknown): string[] {
  const codes: string[] = [];
  for (let current = error; current instanceof Error; current = current.cause) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") codes.push(code);
  }
  return codes;
}

const admin = getAdminDb();

const suffix = randomUUID().slice(0, 8);
const orgAId = randomUUID();
const orgBId = randomUUID();
const userAId = randomUUID();
const userBId = randomUUID();

const ctxA: OrgContext = { orgId: orgAId, userId: userAId, role: "owner" };

async function createAuthUser(id: string, email: string) {
  await admin.execute(
    sql`insert into auth.users (id, email) values (${id}, ${email}) on conflict (id) do nothing`,
  );
}

beforeAll(async () => {
  await createAuthUser(userAId, `a-${suffix}@teste.local`);
  await createAuthUser(userBId, `b-${suffix}@teste.local`);

  await admin.insert(orgs).values([
    { id: orgAId, name: `Escritório A ${suffix}`, slug: `org-a-${suffix}` },
    { id: orgBId, name: `Escritório B ${suffix}`, slug: `org-b-${suffix}` },
  ]);

  await admin.insert(orgMembers).values([
    { orgId: orgAId, userId: userAId, role: "owner" },
    { orgId: orgBId, userId: userBId, role: "owner" },
  ]);
});

afterAll(async () => {
  await admin.delete(orgs).where(eq(orgs.id, orgAId));
  await admin.delete(orgs).where(eq(orgs.id, orgBId));
  await admin.execute(sql`delete from auth.users where id in (${userAId}, ${userBId})`);
});

describe("isolamento entre escritórios", () => {
  it("a role da aplicação não tem bypass de RLS", async () => {
    const [row] = await admin.execute<{ rolbypassrls: boolean }>(
      sql`select rolbypassrls from pg_roles where rolname = 'app_user'`,
    );
    expect(row?.rolbypassrls).toBe(false);
  });

  it("dentro do contexto A, só o escritório A é visível", async () => {
    const visible = await withOrg(ctxA, (tx) => tx.select({ id: orgs.id }).from(orgs));
    expect(visible.map((o) => o.id)).toEqual([orgAId]);
  });

  it("buscar o escritório B pelo id não retorna nada", async () => {
    const found = await withOrg(ctxA, (tx) =>
      tx.select().from(orgs).where(eq(orgs.id, orgBId)),
    );
    expect(found).toHaveLength(0);
  });

  it("atualizar o escritório B não afeta nenhuma linha", async () => {
    const updated = await withOrg(ctxA, (tx) =>
      tx.update(orgs).set({ name: "invadido" }).where(eq(orgs.id, orgBId)).returning(),
    );
    expect(updated).toHaveLength(0);

    const [untouched] = await admin.select().from(orgs).where(eq(orgs.id, orgBId));
    expect(untouched?.name).toBe(`Escritório B ${suffix}`);
  });

  it("inserir vínculo em outro escritório é recusado pela policy", async () => {
    const error = await withOrg(ctxA, (tx) =>
      tx.insert(orgMembers).values({ orgId: orgBId, userId: userAId, role: "admin" }),
    ).then(
      () => null,
      (reason: unknown) => reason,
    );

    expect(error, "o insert deveria ter sido recusado").not.toBeNull();
    // O Drizzle embrulha o erro do driver ("Failed query: ..."); o código do
    // Postgres fica na cadeia de `cause`. 42501 = insufficient_privilege, que é
    // como a RLS recusa uma linha que não passa no WITH CHECK.
    expect(pgErrorCodes(error)).toContain("42501");

    const [notCreated] = await admin
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgBId), eq(orgMembers.userId, userAId)));
    expect(notCreated).toBeUndefined();
  });

  it("perfis de outro escritório não vazam", async () => {
    const visible = await withOrg(ctxA, (tx) => tx.select({ id: profiles.id }).from(profiles));
    const ids = visible.map((p) => p.id);
    expect(ids).toContain(userAId);
    expect(ids).not.toContain(userBId);
  });

  it("query fora de withOrg (sem app.org_id) não enxerga nada", async () => {
    const leaked = await getDb().select({ id: orgs.id }).from(orgs);
    expect(leaked).toHaveLength(0);
  });

  it("o contexto não vaza entre transações", async () => {
    await withOrg(ctxA, async (tx) => {
      const [row] = await tx.execute<{ org: string | null }>(
        sql`select current_setting('app.org_id', true) as org`,
      );
      expect(row?.org).toBe(orgAId);
    });

    // SET LOCAL morre no commit: a conexão volta ao pool sem contexto.
    const [after] = await getDb().execute<{ org: string | null }>(
      sql`select current_setting('app.org_id', true) as org`,
    );
    expect(after?.org ?? "").toBe("");
  });
});
