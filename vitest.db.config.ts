import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: [".env.local", ".env"], quiet: true });

/**
 * Suíte que exige o Postgres local de pé (`pnpm supabase start` + `pnpm db:migrate`).
 * Separada da suíte rápida para `pnpm test` continuar rodando sem infraestrutura.
 */
export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.db.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
