import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getAdminDb } from "../client";
import { createTestOrg, destroyTestOrg, CPFS_VALIDOS, type TestOrg } from "../testing/fixtures";
import { findMembership } from "./orgs";
import { createPerson, deletePerson } from "./people";
import {
  acceptInvite,
  createInvite,
  findInvite,
  listPendingInvites,
  removeMember,
  revokeInvite,
  updateMemberRole,
} from "./team";

const admin = getAdminDb();
let org: TestOrg;
let outro: TestOrg;
const criados: string[] = [];

async function novoUsuario(email: string) {
  const id = randomUUID();
  await admin.execute(sql`insert into auth.users (id, email) values (${id}, ${email})`);
  criados.push(id);
  return { id, email };
}

beforeAll(async () => {
  org = await createTestOrg("equipe");
  outro = await createTestOrg("equipe-outro");
});

afterAll(async () => {
  await destroyTestOrg(org);
  await destroyTestOrg(outro);
  for (const id of criados) await admin.execute(sql`delete from auth.users where id = ${id}`);
});

describe("convite", () => {
  it("entra na equipe com o papel do convite, uma vez só", async () => {
    const email = `convidado-${randomUUID().slice(0, 6)}@teste.local`;
    const { token } = await createInvite(org.ctx, { email: email.toUpperCase(), role: "operacional" });

    expect((await findInvite(token))?.problema).toBeNull();
    expect((await listPendingInvites(org.ctx)).map((i) => i.email)).toContain(email);
    expect(await listPendingInvites(outro.ctx)).toEqual([]);

    const user = await novoUsuario(email);
    const { orgId } = await acceptInvite(token, user);
    expect(orgId).toBe(org.orgId);
    expect((await findMembership(user.id, org.orgId))?.role).toBe("operacional");

    await expect(acceptInvite(token, user)).rejects.toThrow(/já foi usado/);
    expect((await findInvite(token))?.problema).toBe("aceito");
  });

  it("só vale para o e-mail convidado", async () => {
    const { token } = await createInvite(org.ctx, { email: "certo@teste.local", role: "analista" });
    const intruso = await novoUsuario(`intruso-${randomUUID().slice(0, 6)}@teste.local`);
    await expect(acceptInvite(token, intruso)).rejects.toThrow(/certo@teste.local/);
    expect(await findMembership(intruso.id, org.orgId)).toBeNull();
  });

  it("cancelado não entra", async () => {
    const email = `cancelado-${randomUUID().slice(0, 6)}@teste.local`;
    const convite = await createInvite(org.ctx, { email, role: "operacional" });
    await revokeInvite(org.ctx, convite.id);
    await expect(acceptInvite(convite.token, await novoUsuario(email))).rejects.toThrow(/cancelado/);
  });

  it("operacional não convida e admin não cria proprietário", async () => {
    const operacional = { ...org.ctx, role: "operacional" as const };
    await expect(createInvite(operacional, { email: "x@teste.local", role: "operacional" })).rejects.toThrow(
      /administradores/,
    );
    const adm = { ...org.ctx, role: "admin" as const };
    await expect(createInvite(adm, { email: "y@teste.local", role: "owner" })).rejects.toThrow(/proprietário/);
  });
});

describe("papéis", () => {
  it("muda papel e tira da equipe, sem deixar o escritório sem proprietário", async () => {
    const email = `membro-${randomUUID().slice(0, 6)}@teste.local`;
    const { token } = await createInvite(org.ctx, { email, role: "operacional" });
    const membro = await novoUsuario(email);
    await acceptInvite(token, membro);

    await updateMemberRole(org.ctx, membro.id, "admin");
    expect((await findMembership(membro.id, org.orgId))?.role).toBe("admin");

    // O próprio papel não muda, e o único proprietário não sai.
    await expect(updateMemberRole(org.ctx, org.userId, "admin")).rejects.toThrow(/próprio papel/);
    const comoAdmin = { orgId: org.orgId, userId: membro.id, role: "admin" as const };
    await expect(removeMember(comoAdmin, org.userId)).rejects.toThrow(/proprietário/);

    await removeMember(org.ctx, membro.id);
    expect(await findMembership(membro.id, org.orgId)).toBeNull();
  });

  it("operacional não exclui pessoa", async () => {
    const pessoa = await createPerson(org.ctx, { cpf: CPFS_VALIDOS[0], fullName: "PEDRO" } as Parameters<
      typeof createPerson
    >[1]);
    const operacional = { ...org.ctx, role: "operacional" as const };
    await expect(deletePerson(operacional, pessoa.id, "pedro")).rejects.toThrow(/administradores/);
  });
});
