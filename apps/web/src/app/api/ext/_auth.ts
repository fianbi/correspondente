import "server-only";

import type { OrgContext } from "@corr/core";
import { resolveApiToken } from "@corr/db";

/**
 * Autenticação da API da extensão.
 *
 * Bearer token em vez de cookie: a extensão roda em outra origem e não recebe
 * o cookie de sessão (`SameSite=Lax`). Depender de cookie, além de não
 * funcionar, abriria a API para qualquer extensão instalada no navegador.
 */
export async function contextFromRequest(request: Request): Promise<OrgContext | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return resolveApiToken(header.slice("Bearer ".length).trim());
}

/**
 * Cabeçalhos CORS.
 *
 * A origem liberada é `chrome-extension://…`, e nunca `*` com credenciais:
 * um site qualquer não pode chamar esta API. Como a autenticação é por token
 * no cabeçalho, não há cookie em jogo de qualquer forma.
 */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const permitida = origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://");

  return {
    "Access-Control-Allow-Origin": permitida ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(request: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

export function unauthorized(request: Request): Response {
  return json(request, { error: "Token inválido ou revogado." }, 401);
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
