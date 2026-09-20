import "./load-env";

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readDbEnv } from "./env";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * A migration cria a role `app_user` sem login — senha em arquivo versionado
 * não existe. Quem define a credencial é a própria DATABASE_URL: aqui ela é
 * lida e aplicada na role, então ambiente e banco nunca saem de sincronia.
 */
async function syncAppRoleCredentials(adminSql: postgres.Sql, appUrl: string) {
  const url = new URL(appUrl);
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);

  if (user !== "app_user") {
    console.log(`DATABASE_URL usa a role "${user}"; credencial de app_user não foi alterada.`);
    return;
  }
  if (!password) {
    throw new Error("DATABASE_URL da role app_user precisa incluir senha.");
  }

  await adminSql.unsafe(`alter role app_user login password '${password.replace(/'/g, "''")}'`);
  console.log("role app_user habilitada para login");
}

async function main() {
  const env = readDbEnv();
  const adminUrl = env.DATABASE_ADMIN_URL ?? env.DATABASE_URL;
  // Conexão única: DDL concorrente com pool aberto trava em lock.
  const client = postgres(adminUrl, { max: 1, prepare: false, onnotice: () => {} });

  try {
    await migrate(drizzle(client), { migrationsFolder: resolve(here, "../migrations") });
    console.log("migrations aplicadas");

    if (env.DATABASE_ADMIN_URL) {
      await syncAppRoleCredentials(client, env.DATABASE_URL);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
