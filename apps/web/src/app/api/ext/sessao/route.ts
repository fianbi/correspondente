import { getOrg } from "@corr/db";
import { contextFromRequest, json, preflight, unauthorized } from "../_auth";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/** Confirma o token e diz de qual escritório ele é. */
export async function GET(request: Request) {
  const ctx = await contextFromRequest(request);
  if (!ctx) return unauthorized(request);

  const org = await getOrg(ctx);
  return json(request, { orgId: org.id, orgName: org.name });
}
