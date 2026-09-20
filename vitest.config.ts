import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    // A suíte de isolamento de tenant precisa do Postgres local de pé; ela é
    // rodada à parte por `pnpm test:db`.
    exclude: ["**/node_modules/**", "**/*.db.test.ts"],
  },
});
