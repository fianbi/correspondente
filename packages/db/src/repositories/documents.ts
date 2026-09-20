import {
  type DocumentStatus,
  type DocumentType,
  type OrgContext,
  type StageRequirement,
  NotFoundError,
} from "@corr/core";
import { and, desc, eq, inArray } from "drizzle-orm";
import { withOrg } from "../client";
import { documents } from "../schema/documents";
import { profiles } from "../schema/orgs";

export interface NewDocumentInput {
  processId?: string | null;
  personId?: string | null;
  type: DocumentType;
  title: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  stageKey?: string | null;
  source?: "interno" | "portal";
  uploadedByName?: string | null;
}

export async function registerDocument(ctx: OrgContext, input: NewDocumentInput) {
  return withOrg(ctx, async (tx) => {
    const [created] = await tx
      .insert(documents)
      .values({
        orgId: ctx.orgId,
        processId: input.processId ?? null,
        personId: input.personId ?? null,
        type: input.type,
        title: input.title,
        storagePath: input.storagePath,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        stageKey: input.stageKey ?? null,
        source: input.source ?? "interno",
        uploadedBy: input.source === "portal" ? null : ctx.userId,
        uploadedByName: input.uploadedByName ?? null,
      })
      .returning();

    if (!created) throw new Error("Falha ao registrar o documento.");
    return created;
  });
}

const documentSelection = {
  id: documents.id,
  processId: documents.processId,
  personId: documents.personId,
  type: documents.type,
  title: documents.title,
  storagePath: documents.storagePath,
  mimeType: documents.mimeType,
  sizeBytes: documents.sizeBytes,
  status: documents.status,
  source: documents.source,
  stageKey: documents.stageKey,
  uploadedByName: documents.uploadedByName,
  uploaderName: profiles.fullName,
  reviewNotes: documents.reviewNotes,
  createdAt: documents.createdAt,
} as const;

export async function listProcessDocuments(ctx: OrgContext, processId: string) {
  return withOrg(ctx, (tx) =>
    tx
      .select(documentSelection)
      .from(documents)
      .leftJoin(profiles, eq(profiles.id, documents.uploadedBy))
      .where(and(eq(documents.orgId, ctx.orgId), eq(documents.processId, processId)))
      .orderBy(desc(documents.createdAt)),
  );
}

export type DocumentRow = Awaited<ReturnType<typeof listProcessDocuments>>[number];

export async function listOrgDocuments(ctx: OrgContext, limit = 200) {
  return withOrg(ctx, (tx) =>
    tx
      .select({ ...documentSelection, processIdRef: documents.processId })
      .from(documents)
      .leftJoin(profiles, eq(profiles.id, documents.uploadedBy))
      .where(eq(documents.orgId, ctx.orgId))
      .orderBy(desc(documents.createdAt))
      .limit(limit),
  );
}

export async function getDocument(ctx: OrgContext, documentId: string) {
  return withOrg(ctx, async (tx) => {
    const [document] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.orgId, ctx.orgId), eq(documents.id, documentId)))
      .limit(1);
    if (!document) throw new NotFoundError("Documento");
    return document;
  });
}

export async function reviewDocument(
  ctx: OrgContext,
  documentId: string,
  status: DocumentStatus,
  notes?: string | null,
) {
  return withOrg(ctx, async (tx) => {
    const [updated] = await tx
      .update(documents)
      .set({
        status,
        reviewedBy: ctx.userId,
        reviewedAt: new Date(),
        reviewNotes: notes ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(documents.orgId, ctx.orgId), eq(documents.id, documentId)))
      .returning();
    if (!updated) throw new NotFoundError("Documento");
    return updated;
  });
}

export async function deleteDocument(ctx: OrgContext, documentId: string) {
  return withOrg(ctx, async (tx) => {
    const [deleted] = await tx
      .delete(documents)
      .where(and(eq(documents.orgId, ctx.orgId), eq(documents.id, documentId)))
      .returning({ storagePath: documents.storagePath });
    if (!deleted) throw new NotFoundError("Documento");
    return deleted;
  });
}

export interface ChecklistItem extends StageRequirement {
  /** Documentos já recebidos para este tipo. */
  received: { id: string; title: string; status: DocumentStatus }[];
  satisfied: boolean;
}

/**
 * Cruza o checklist da etapa com o que já chegou.
 *
 * Um documento rejeitado não satisfaz a exigência — senão a etapa pareceria
 * completa com um arquivo que a análise já recusou.
 */
export async function buildChecklist(
  ctx: OrgContext,
  processId: string,
  requirements: StageRequirement[],
): Promise<ChecklistItem[]> {
  if (requirements.length === 0) return [];

  const types = requirements.map((r) => r.documentType as DocumentType);

  const rows = await withOrg(ctx, (tx) =>
    tx
      .select({
        id: documents.id,
        title: documents.title,
        type: documents.type,
        status: documents.status,
      })
      .from(documents)
      .where(
        and(
          eq(documents.orgId, ctx.orgId),
          eq(documents.processId, processId),
          inArray(documents.type, types),
        ),
      ),
  );

  return requirements.map((requirement) => {
    const received = rows.filter((row) => row.type === requirement.documentType);
    return {
      ...requirement,
      received: received.map(({ id, title, status }) => ({ id, title, status })),
      satisfied: received.some((row) => row.status !== "rejeitado"),
    };
  });
}
