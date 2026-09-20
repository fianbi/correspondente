import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Scripts do pacote (migrate, seed, testes de banco) rodam fora do Next, que é
 * quem normalmente carrega o .env. Importar este módulo primeiro resolve isso.
 * O .env.local da raiz vence o .env — mesma precedência do Next.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

config({ path: [resolve(repoRoot, ".env.local"), resolve(repoRoot, ".env")], quiet: true });
