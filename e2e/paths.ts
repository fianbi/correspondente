import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/** Cookies da sessão reaproveitada entre os testes (gerado por `auth.setup.ts`). */
export const STORAGE_STATE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".auth/user.json",
);
