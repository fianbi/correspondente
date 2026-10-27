import { json, preflight, sessionFromRequest, unauthorized } from "../_auth";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/** Confirma a sessão da web e diz com qual usuário e escritório a extensão está. */
export async function GET(request: Request) {
  const sessao = await sessionFromRequest(request);
  if (!sessao) return unauthorized(request);

  return json(request, {
    email: sessao.email,
    orgId: sessao.ctx.orgId,
    orgName: sessao.orgName,
  });
}
