import type { OrgContext } from "@corr/core";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readDbEnv } from "./env";
import * as schema from "./schema/index";

export type Database = ReturnType<typeof createDatabase>;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

function createDatabase(url: string, max: number) {
  const client = postgres(url, {
    max,
    prepare: false,
    onnotice: () => {},
    // Conexão ociosa devolvida ao Postgres: em desenvolvimento, vários
    // reinícios do dev server não deixam conexões penduradas.
    idle_timeout: 30,
  });
  return drizzle(client, { schema, casing: "snake_case" });
}

// Os dois pools são guardados no escopo global porque o dev server do Next
// recarrega módulos a cada edição — e porque `getAdminDb()` é chamada a cada
// requisição (para descobrir a que escritório o usuário pertence). Sem cache,
// cada chamada abria um pool novo que nunca fechava, até o Postgres responder
// "remaining connection slots are reserved for roles with the SUPERUSER
// attribute" e derrubar junto o serviço de autenticação.
const globalForDb = globalThis as unknown as { __corrDb?: Database; __corrAdminDb?: Database };

export function getDb(): Database {
  if (!globalForDb.__corrDb) {
    globalForDb.__corrDb = createDatabase(readDbEnv().DATABASE_URL, 10);
  }
  return globalForDb.__corrDb;
}

/**
 * Único portão de acesso a dados de escritório.
 *
 * Abre uma transação, fixa `app.org_id`/`app.user_id` nela (SET LOCAL, some no
 * commit) e só então entrega a transação ao chamador. As policies de RLS leem
 * esses valores, então uma query que esqueça o `where org_id` volta vazia em vez
 * de vazar dado de outro escritório.
 */
export async function withOrg<T>(ctx: OrgContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.org_id', ${ctx.orgId}, true), set_config('app.user_id', ${ctx.userId}, true)`,
    );
    return fn(tx);
  });
}

/**
 * Conexão privilegiada para o que roda fora de um tenant: migrations, criação
 * de escritório no signup e jobs administrativos. Use com parcimônia — aqui a
 * RLS não protege ninguém.
 */
export function getAdminDb(): Database {
  if (!globalForDb.__corrAdminDb) {
    const env = readDbEnv();
    // Pool menor: por aqui passam só resolução de tenant, migrations e rotinas
    // administrativas, não o tráfego das telas.
    globalForDb.__corrAdminDb = createDatabase(env.DATABASE_ADMIN_URL ?? env.DATABASE_URL, 5);
  }
  return globalForDb.__corrAdminDb;
}
