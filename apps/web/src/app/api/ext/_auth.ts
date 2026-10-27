import "server-only";

import { cookies } from "next/headers";
import type { OrgContext } from "@corr/core";
import { findMembership, listMembershipsForUser } from "@corr/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/server/session";

/**
 * Autenticação da API da extensão.
 *
 * A extensão não tem login próprio: usa a sessão da web no mesmo navegador.
 * Como ela tem permissão de host para o endereço do sistema, o Chrome manda o
 * cookie de sessão junto nas chamadas com `credentials: "include"`. Assim a
 * extensão é sempre quem está logado na web, e "Sair" ou trocar de usuário lá
 * vale aqui na próxima chamada.
 *
 * O escritório é o mesmo da web (cookie `corr_org`), conferido no banco como em
 * `requireOrgContext`: é o vínculo que dá o papel, então quem sai do escritório
 * perde o acesso na próxima chamada.
 */
export interface ExtensionSession {
  ctx: OrgContext;
  email: string;
  orgName: string;
}

export async function sessionFromRequest(request: Request): Promise<ExtensionSession | null> {
  // O cookie vai em qualquer requisição ao sistema; só aceita quem vem da
  // extensão (ou do próprio sistema). Um site comum não chega aqui com ele.
  const origin = request.headers.get("origin");
  if (origin && !origemDeExtensaoPermitida(origin) && origin !== new URL(request.url).origin) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const memberships = await listMembershipsForUser(user.id);
  if (memberships.length === 0) return null;

  const requestedOrgId = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const active = requestedOrgId
    ? ((await findMembership(user.id, requestedOrgId)) ?? memberships[0]!)
    : memberships[0]!;

  return {
    ctx: { orgId: active.orgId, userId: user.id, role: active.role },
    email: user.email ?? "",
    orgName: active.orgName,
  };
}

export async function contextFromRequest(request: Request): Promise<OrgContext | null> {
  return (await sessionFromRequest(request))?.ctx ?? null;
}

/**
 * Origens de extensão aceitas: `EXTENSION_ORIGINS`, separadas por vírgula
 * (ex.: `chrome-extension://<id>`). Sem a variável, só em desenvolvimento,
 * qualquer extensão carregada sem empacotar serve, já que o ID muda por máquina.
 */
function origemDeExtensaoPermitida(origin: string): boolean {
  const lista = process.env.EXTENSION_ORIGINS?.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (lista?.length) return lista.includes(origin);
  if (process.env.NODE_ENV === "production") return false;
  return origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://");
}

/**
 * Cabeçalhos CORS.
 *
 * Com credenciais a origem precisa ser exata, nunca `*`: só a extensão
 * permitida lê as respostas. As chamadas que gravam mandam JSON, o que força o
 * preflight, e um site comum recebe `null` nele.
 */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const permitida = origemDeExtensaoPermitida(origin);

  return {
    "Access-Control-Allow-Origin": permitida ? origin : "null",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(request: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

export function unauthorized(request: Request): Response {
  return json(request, { error: "Sessão expirada ou sem acesso a este escritório." }, 401);
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
