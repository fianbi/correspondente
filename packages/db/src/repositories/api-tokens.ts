import { createHash, randomBytes } from "node:crypto";
import type { OrgContext, OrgRole } from "@corr/core";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getAdminDb, withOrg } from "../client";
import { apiTokens, siteMappings } from "../schema/documents";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Prefixo visível: ajuda a reconhecer o token sem revelar nada dele. */
const PREFIXO = "corr_";

export async function createApiToken(ctx: OrgContext, label: string) {
  const token = `${PREFIXO}${randomBytes(24).toString("base64url")}`;

  return withOrg(ctx, async (tx) => {
    const [created] = await tx
      .insert(apiTokens)
      .values({ orgId: ctx.orgId, userId: ctx.userId, tokenHash: hashToken(token), label })
      .returning({ id: apiTokens.id, label: apiTokens.label });

    if (!created) throw new Error("Falha ao gerar o token.");
    // Única vez que o token existe em claro.
    return { ...created, token };
  });
}

export async function listApiTokens(ctx: OrgContext) {
  return withOrg(ctx, (tx) =>
    tx
      .select({
        id: apiTokens.id,
        label: apiTokens.label,
        lastUsedAt: apiTokens.lastUsedAt,
        createdAt: apiTokens.createdAt,
        revoked: sql<boolean>`${apiTokens.revokedAt} is not null`,
      })
      .from(apiTokens)
      .where(and(eq(apiTokens.orgId, ctx.orgId), eq(apiTokens.userId, ctx.userId)))
      .orderBy(desc(apiTokens.createdAt)),
  );
}

export async function revokeApiToken(ctx: OrgContext, tokenId: string) {
  return withOrg(ctx, async (tx) => {
    await tx
      .update(apiTokens)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(apiTokens.orgId, ctx.orgId), eq(apiTokens.id, tokenId)));
  });
}

/**
 * Resolve o token da extensão para um contexto de escritório.
 *
 * Roda na conexão administrativa porque é justamente este passo que descobre
 * de qual escritório é o chamador — a partir daqui, tudo volta a passar por
 * `withOrg` com o contexto que saiu do token.
 */
export async function resolveApiToken(token: string | null): Promise<OrgContext | null> {
  if (!token || !token.startsWith(PREFIXO)) return null;

  const [row] = await getAdminDb()
    .select({ id: apiTokens.id, orgId: apiTokens.orgId, userId: apiTokens.userId })
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, hashToken(token)), isNull(apiTokens.revokedAt)))
    .limit(1);

  if (!row) return null;

  await getAdminDb()
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, row.id));

  // O papel real vem do vínculo; `analista` é o piso para a extensão operar.
  return { orgId: row.orgId, userId: row.userId, role: "analista" as OrgRole };
}

export async function listSiteMappings(ctx: OrgContext, portalKey: string) {
  return withOrg(ctx, (tx) =>
    tx
      .select({
        screenKey: siteMappings.screenKey,
        dataKey: siteMappings.dataKey,
        selector: siteMappings.selector,
        transform: siteMappings.transform,
      })
      .from(siteMappings)
      .where(and(eq(siteMappings.orgId, ctx.orgId), eq(siteMappings.portalKey, portalKey))),
  );
}

export async function saveSiteMapping(
  ctx: OrgContext,
  input: { portalKey: string; screenKey: string; dataKey: string; selector: string; transform?: string | null },
) {
  return withOrg(ctx, async (tx) => {
    await tx
      .insert(siteMappings)
      .values({ ...input, orgId: ctx.orgId, createdBy: ctx.userId })
      .onConflictDoUpdate({
        target: [
          siteMappings.orgId,
          siteMappings.portalKey,
          siteMappings.screenKey,
          siteMappings.dataKey,
        ],
        set: { selector: input.selector, transform: input.transform ?? null, updatedAt: new Date() },
      });
  });
}
