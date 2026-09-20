import type { Route } from "next";

/**
 * O `?next=` vem da URL, ou seja, do usuário. Só passa caminho interno: `//host`
 * e `https://host` seriam redirect aberto para fora do sistema.
 */
export function safeInternalPath(candidate: string | null | undefined, fallback = "/painel"): Route {
  if (!candidate) return fallback as Route;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback as Route;
  if (candidate.includes("\\")) return fallback as Route;
  return candidate as Route;
}
