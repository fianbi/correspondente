import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

// O Next só lê .env da pasta do app; neste monorepo o arquivo é único, na raiz,
// porque as mesmas credenciais servem para migrations, seed e testes de banco.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadEnv({ path: [resolve(repoRoot, ".env.local"), resolve(repoRoot, ".env")], quiet: true });

const config: NextConfig = {
  // Os pacotes do monorepo exportam TypeScript direto, sem build intermediário.
  transpilePackages: ["@corr/core", "@corr/db"],
  serverExternalPackages: ["postgres"],
  typedRoutes: true,
  experimental: {
    authInterrupts: true,
  },
  // Inlina no bundle do cliente o que veio do .env da raiz.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  },
};

export default config;
