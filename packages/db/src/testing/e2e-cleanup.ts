import { sql } from "drizzle-orm";
import { getAdminDb } from "../client";

/**
 * Limpeza da suíte E2E.
 *
 * Os testes de navegador rodam no escritório do usuário de desenvolvimento
 * (o mesmo do seed), e cada execução abre processos e cadastra pessoas. Sem
 * limpar, o escritório de dev acumula centenas de processos da mesma pessoa,
 * que aparecem na web e na extensão como se fossem dados de verdade.
 *
 * Apaga só o que nasceu depois de `desde` naquele escritório: o que o seed
 * criou fica.
 */

/** Relógio do banco, para não depender do relógio da máquina dos testes. */
export async function e2eStartedAt(): Promise<string> {
  const rows = await getAdminDb().execute<{ now: string }>(sql`select now()::text as now`);
  return rows[0]!.now;
}

export async function cleanupE2eData(email: string, desde: string): Promise<void> {
  const admin = getAdminDb();
  await admin.transaction(async (tx) => {
    const orgs = sql`(
      select m.org_id from public.org_members m
      join auth.users u on u.id = m.user_id
      where u.email = ${email}
    )`;
    const pessoas = sql`(
      select id from public.people
      where org_id in ${orgs} and created_at >= ${desde}::timestamptz
    )`;

    await tx.execute(sql`
      delete from public.processes
      where org_id in ${orgs} and created_at >= ${desde}::timestamptz
    `);
    // Pessoa nova pode ter entrado como participante de um processo do seed.
    await tx.execute(sql`delete from public.process_participants where person_id in ${pessoas}`);
    await tx.execute(sql`delete from public.people where id in ${pessoas}`);
  });
}
