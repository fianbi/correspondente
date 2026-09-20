import { type OrgContext, NotFoundError } from "@corr/core";
import { and, asc, eq } from "drizzle-orm";
import { withOrg } from "../client";
import { formTemplates } from "../schema/documents";

export async function listFormTemplates(ctx: OrgContext) {
  return withOrg(ctx, (tx) =>
    tx
      .select()
      .from(formTemplates)
      .where(eq(formTemplates.orgId, ctx.orgId))
      .orderBy(asc(formTemplates.name)),
  );
}

export async function getFormTemplate(ctx: OrgContext, templateId: string) {
  return withOrg(ctx, async (tx) => {
    const [template] = await tx
      .select()
      .from(formTemplates)
      .where(and(eq(formTemplates.orgId, ctx.orgId), eq(formTemplates.id, templateId)))
      .limit(1);
    if (!template) throw new NotFoundError("Modelo de formulário");
    return template;
  });
}

export async function createFormTemplate(
  ctx: OrgContext,
  input: { name: string; description?: string | null; storagePath: string; detectedFields: string[] },
) {
  return withOrg(ctx, async (tx) => {
    const [created] = await tx
      .insert(formTemplates)
      .values({
        orgId: ctx.orgId,
        name: input.name,
        description: input.description ?? null,
        storagePath: input.storagePath,
        detectedFields: input.detectedFields,
        createdBy: ctx.userId,
      })
      .returning();
    if (!created) throw new Error("Falha ao salvar o modelo.");
    return created;
  });
}

export async function updateFormTemplateMap(
  ctx: OrgContext,
  templateId: string,
  fieldMap: Record<string, string>,
) {
  return withOrg(ctx, async (tx) => {
    const [updated] = await tx
      .update(formTemplates)
      .set({ fieldMap, updatedAt: new Date() })
      .where(and(eq(formTemplates.orgId, ctx.orgId), eq(formTemplates.id, templateId)))
      .returning();
    if (!updated) throw new NotFoundError("Modelo de formulário");
    return updated;
  });
}

export async function deleteFormTemplate(ctx: OrgContext, templateId: string) {
  return withOrg(ctx, async (tx) => {
    const [deleted] = await tx
      .delete(formTemplates)
      .where(and(eq(formTemplates.orgId, ctx.orgId), eq(formTemplates.id, templateId)))
      .returning({ storagePath: formTemplates.storagePath });
    if (!deleted) throw new NotFoundError("Modelo de formulário");
    return deleted;
  });
}
