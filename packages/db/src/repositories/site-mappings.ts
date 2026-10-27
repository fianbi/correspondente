import type { OrgContext } from "@corr/core";
import { and, eq } from "drizzle-orm";
import { withOrg } from "../client";
import { siteMappings } from "../schema/documents";

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
