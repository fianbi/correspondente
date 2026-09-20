import { type OrgContext, NotFoundError } from "@corr/core";
import { aliasedTable, and, asc, desc, eq } from "drizzle-orm";
import { withOrg } from "../client";
import { pendencies } from "../schema/documents";
import { profiles } from "../schema/orgs";
import { people } from "../schema/people";
import { processes } from "../schema/processes";

const assignee = aliasedTable(profiles, "assignee");
const author = aliasedTable(profiles, "author");

const selection = {
  id: pendencies.id,
  processId: pendencies.processId,
  stageKey: pendencies.stageKey,
  title: pendencies.title,
  description: pendencies.description,
  status: pendencies.status,
  pinned: pendencies.pinned,
  dueDate: pendencies.dueDate,
  createdAt: pendencies.createdAt,
  resolvedAt: pendencies.resolvedAt,
  assignedToName: assignee.fullName,
  createdByName: author.fullName,
} as const;

export async function listProcessPendencies(ctx: OrgContext, processId: string) {
  return withOrg(ctx, (tx) =>
    tx
      .select(selection)
      .from(pendencies)
      .leftJoin(assignee, eq(assignee.id, pendencies.assignedTo))
      .leftJoin(author, eq(author.id, pendencies.createdBy))
      .where(and(eq(pendencies.orgId, ctx.orgId), eq(pendencies.processId, processId)))
      .orderBy(desc(pendencies.pinned), asc(pendencies.status), desc(pendencies.createdAt)),
  );
}

export type PendencyRow = Awaited<ReturnType<typeof listProcessPendencies>>[number];

/** Visão global: tudo que está travado, sem abrir processo por processo. */
export async function listOpenPendencies(ctx: OrgContext) {
  return withOrg(ctx, (tx) =>
    tx
      .select({
        ...selection,
        processNumber: processes.number,
        clientName: people.fullName,
      })
      .from(pendencies)
      .innerJoin(processes, eq(processes.id, pendencies.processId))
      .innerJoin(people, eq(people.id, processes.personId))
      .leftJoin(assignee, eq(assignee.id, pendencies.assignedTo))
      .leftJoin(author, eq(author.id, pendencies.createdBy))
      .where(and(eq(pendencies.orgId, ctx.orgId), eq(pendencies.status, "aberta")))
      .orderBy(desc(pendencies.pinned), asc(pendencies.dueDate), desc(pendencies.createdAt)),
  );
}

export async function createPendency(
  ctx: OrgContext,
  input: {
    processId: string;
    stageKey?: string | null;
    title: string;
    description?: string | null;
    assignedTo?: string | null;
    dueDate?: Date | null;
  },
) {
  return withOrg(ctx, async (tx) => {
    const [created] = await tx
      .insert(pendencies)
      .values({
        orgId: ctx.orgId,
        processId: input.processId,
        stageKey: input.stageKey ?? null,
        title: input.title,
        description: input.description ?? null,
        assignedTo: input.assignedTo ?? null,
        dueDate: input.dueDate ?? null,
        createdBy: ctx.userId,
      })
      .returning();
    if (!created) throw new Error("Falha ao criar a pendência.");
    return created;
  });
}

export async function resolvePendency(ctx: OrgContext, pendencyId: string) {
  return withOrg(ctx, async (tx) => {
    const [updated] = await tx
      .update(pendencies)
      .set({
        status: "resolvida",
        resolvedBy: ctx.userId,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(pendencies.orgId, ctx.orgId), eq(pendencies.id, pendencyId)))
      .returning();
    if (!updated) throw new NotFoundError("Pendência");
    return updated;
  });
}

export async function reopenPendency(ctx: OrgContext, pendencyId: string) {
  return withOrg(ctx, async (tx) => {
    await tx
      .update(pendencies)
      .set({ status: "aberta", resolvedAt: null, resolvedBy: null, updatedAt: new Date() })
      .where(and(eq(pendencies.orgId, ctx.orgId), eq(pendencies.id, pendencyId)));
  });
}

export async function countOpenPendencies(ctx: OrgContext, processId: string): Promise<number> {
  const rows = await withOrg(ctx, (tx) =>
    tx
      .select({ id: pendencies.id })
      .from(pendencies)
      .where(
        and(
          eq(pendencies.orgId, ctx.orgId),
          eq(pendencies.processId, processId),
          eq(pendencies.status, "aberta"),
        ),
      ),
  );
  return rows.length;
}
