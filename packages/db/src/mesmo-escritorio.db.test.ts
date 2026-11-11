import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getAdminDb } from "./client";
import { createTestOrg, destroyTestOrg, CPFS_VALIDOS, type TestOrg } from "./testing/fixtures";
import { createPerson } from "./repositories/people";
import { createProcess, getProcess } from "./repositories/processes";
import { addProcessParticipant } from "./repositories/participants";

/**
 * A RLS esconde o que é de outro escritório, mas a chave estrangeira não passa
 * por ela. Os gatilhos da migração 0028 fecham esse caminho: nenhuma ligação
 * aponta para registro de outro escritório.
 */

const admin = getAdminDb();
let orgA: TestOrg;
let orgB: TestOrg;

beforeAll(async () => {
  orgA = await createTestOrg("mesmo-a");
  orgB = await createTestOrg("mesmo-b");
});

afterAll(async () => {
  await destroyTestOrg(orgA);
  await destroyTestOrg(orgB);
});

async function pessoa(org: TestOrg, cpf: string, nome: string) {
  return createPerson(org.ctx, { cpf, fullName: nome } as Parameters<typeof createPerson>[1]);
}

describe("ligação entre escritórios", () => {
  it("processo não aceita participante de outro escritório", async () => {
    const daCasa = await pessoa(orgA, CPFS_VALIDOS[0], "PESSOA DA CASA");
    const deFora = await pessoa(orgB, CPFS_VALIDOS[1], "PESSOA DE FORA");
    const processo = await createProcess(orgA.ctx, { personId: daCasa.id } as Parameters<
      typeof createProcess
    >[1]);

    await expect(addProcessParticipant(orgA.ctx, processo.id, deFora.id, "conjuge")).rejects.toThrow();

    const atual = await getProcess(orgA.ctx, processo.id);
    expect(atual.participants.map((p) => p.personId)).toEqual([daCasa.id]);
  });

  it("participante do mesmo escritório entra normalmente", async () => {
    const titular = await pessoa(orgA, CPFS_VALIDOS[2], "TITULAR");
    const conjuge = await pessoa(orgA, CPFS_VALIDOS[3], "CONJUGE");
    const processo = await createProcess(orgA.ctx, { personId: titular.id } as Parameters<
      typeof createProcess
    >[1]);

    await addProcessParticipant(orgA.ctx, processo.id, conjuge.id, "conjuge");
    const atual = await getProcess(orgA.ctx, processo.id);
    expect(atual.participants.map((p) => p.personId).sort()).toEqual([titular.id, conjuge.id].sort());
  });

  it("responsável precisa ser da equipe do escritório", async () => {
    const titular = await pessoa(orgA, CPFS_VALIDOS[4], "RESPONSAVEL TESTE");
    const processo = await createProcess(orgA.ctx, { personId: titular.id } as Parameters<
      typeof createProcess
    >[1]);

    await expect(
      admin.execute(sql`update processes set assigned_to = ${orgB.userId} where id = ${processo.id}`),
    ).rejects.toThrow();
    await admin.execute(sql`update processes set assigned_to = ${orgA.userId} where id = ${processo.id}`);
  });

  it("toda ligação entre tabelas de escritório tem o gatilho", async () => {
    // Lido do catálogo: uma chave estrangeira nova entre tabelas com org_id,
    // sem o gatilho, faz este teste falhar.
    const faltando = await admin.execute<{ tabela: string; coluna: string }>(sql`
      select c.conrelid::regclass::text as tabela, a.attname as coluna
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f'
        and c.connamespace = 'public'::regnamespace
        and a.attname <> 'org_id'
        and exists (select 1 from pg_attribute x where x.attrelid = c.confrelid and x.attname = 'org_id')
        and exists (select 1 from pg_attribute x where x.attrelid = c.conrelid and x.attname = 'org_id')
        and not exists (
          select 1 from pg_trigger t
          where t.tgrelid = c.conrelid and t.tgname = 'mesmo_escritorio_' || a.attname
        )
    `);
    expect([...faltando]).toEqual([]);
  });
});
