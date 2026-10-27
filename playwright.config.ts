import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE } from "./e2e/paths";

loadEnv({ path: [".env.local", ".env"], quiet: true });

/**
 * E2E contra a stack local: exige `pnpm supabase start`, `pnpm db:migrate` e
 * `pnpm db:seed`. O servidor é reaproveitado se já estiver de pé.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    locale: "pt-BR",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/login",
    // Em CI sempre sobe um servidor limpo: reusar um dev server que dividiu o
    // diretório .next com um `next build` dá falha fantasma.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
