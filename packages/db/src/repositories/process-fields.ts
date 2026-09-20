import {
  type FieldChange,
  type FieldValue,
  type OrgContext,
  NotFoundError,
  diffFieldValues,
  requireField,
  splitByStorage,
} from "@corr/core";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { withOrg, type Tx } from "../client";
import { processEvents, processFieldValues, processStageStates } from "../schema/flows";
import { processes } from "../schema/processes";

/** Serializa para o log de auditoria, que guarda tudo como texto. */
function asText(value: FieldValue): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

/**
 * Lê os valores atuais das chaves pedidas, venham elas de coluna nativa de
 * `processes` ou da tabela de valores.
 */
async function readCurrentValues(
  tx: Tx,
  ctx: OrgContext,
  processId: string,
  keys: string[],
): Promise<Record<string, FieldValue>> {
  const [process] = await tx
    .select()
    .from(processes)
    .where(and(eq(processes.orgId, ctx.orgId), eq(processes.id, processId)))
    .limit(1);

  if (!process) throw new NotFoundError("Processo");

  const storedKeys = keys.filter((key) => requireField(key).storage.kind === "value");
  const stored =
    storedKeys.length === 0
      ? []
      : await tx
          .select()
          .from(processFieldValues)
          .where(
            and(
              eq(processFieldValues.orgId, ctx.orgId),
              eq(processFieldValues.processId, processId),
              inArray(processFieldValues.fieldKey, storedKeys),
            ),
          );

  const storedByKey = new Map(stored.map((row) => [row.fieldKey, row.value]));
  const current: Record<string, FieldValue> = {};

  for (const key of keys) {
    const def = requireField(key);
    if (def.storage.kind === "column") {
      const raw = (process as Record<string, unknown>)[def.storage.column];
      current[key] = (raw ?? null) as FieldValue;
    } else {
      current[key] = storedByKey.get(key) ?? null;
    }
  }

  return current;
}

export interface PatchResult {
  changes: FieldChange[];
}

/**
 * Único caminho de escrita de campos de um processo.
 *
 * Calcula o diff contra o que está gravado, aplica só o que mudou e registra
 * cada alteração em `process_events`. Como toda tela passa por aqui, a aba de
 * histórico é apenas uma leitura — ninguém precisa lembrar de "logar" nada, e
 * um salvar sem mudança não gera evento algum.
 */
export async function applyProcessPatch(
  ctx: OrgContext,
  processId: string,
  values: Record<string, FieldValue>,
): Promise<PatchResult> {
  const keys = Object.keys(values);
  if (keys.length === 0) return { changes: [] };

  return withOrg(ctx, async (tx) => {
    const before = await readCurrentValues(tx, ctx, processId, keys);
    const changes = diffFieldValues(before, values);
    if (changes.length === 0) return { changes: [] };

    const changed = Object.fromEntries(changes.map((c) => [c.key, c.to]));
    const { columns, stored } = splitByStorage(changed);

    if (Object.keys(columns).length > 0) {
      await tx
        .update(processes)
        .set({ ...columns, updatedAt: new Date() })
        .where(and(eq(processes.orgId, ctx.orgId), eq(processes.id, processId)));
    }

    for (const [fieldKey, value] of Object.entries(stored)) {
      await tx
        .insert(processFieldValues)
        .values({
          orgId: ctx.orgId,
          processId,
          fieldKey,
          value: asText(value),
          updatedBy: ctx.userId,
        })
        .onConflictDoUpdate({
          target: [processFieldValues.processId, processFieldValues.fieldKey],
          set: { value: asText(value), updatedBy: ctx.userId, updatedAt: new Date() },
        });
    }

    // Um evento por campo: a tela de histórico mostra "de → para" linha a linha.
    await tx.insert(processEvents).values(
      changes.map((change) => ({
        orgId: ctx.orgId,
        processId,
        actorId: ctx.userId,
        kind: "campo_alterado" as const,
        fieldKey: change.key,
        oldValue: asText(change.from),
        newValue: asText(change.to),
      })),
    );

    // `processes.updatedAt` move o processo para o topo da listagem mesmo
    // quando só campos da tabela de valores mudaram.
    if (Object.keys(columns).length === 0) {
      await tx
        .update(processes)
        .set({ updatedAt: new Date() })
        .where(and(eq(processes.orgId, ctx.orgId), eq(processes.id, processId)));
    }

    return { changes };
  });
}

/** Todos os valores gravados de um processo, indexados por chave do catálogo. */
export async function getProcessFieldValues(
  ctx: OrgContext,
  processId: string,
): Promise<Record<string, string | null>> {
  return withOrg(ctx, async (tx) => {
    const rows = await tx
      .select({ fieldKey: processFieldValues.fieldKey, value: processFieldValues.value })
      .from(processFieldValues)
      .where(
        and(eq(processFieldValues.orgId, ctx.orgId), eq(processFieldValues.processId, processId)),
      );

    return Object.fromEntries(rows.map((row) => [row.fieldKey, row.value]));
  });
}

export async function listProcessEvents(ctx: OrgContext, processId: string, limit = 200) {
  return withOrg(ctx, (tx) =>
    tx
      .select()
      .from(processEvents)
      .where(and(eq(processEvents.orgId, ctx.orgId), eq(processEvents.processId, processId)))
      .orderBy(desc(processEvents.createdAt))
      .limit(limit),
  );
}

/** Registra um evento que não é alteração de campo (fase, etapa, responsável). */
export async function recordProcessEvent(
  tx: Tx,
  ctx: OrgContext,
  processId: string,
  kind: (typeof processEvents.kind.enumValues)[number],
  detail: { fieldKey?: string; oldValue?: string | null; newValue?: string | null } = {},
) {
  await tx.insert(processEvents).values({
    orgId: ctx.orgId,
    processId,
    actorId: ctx.userId,
    kind,
    fieldKey: detail.fieldKey ?? null,
    oldValue: detail.oldValue ?? null,
    newValue: detail.newValue ?? null,
  });
}

export async function listStageStates(ctx: OrgContext, processId: string) {
  return withOrg(ctx, (tx) =>
    tx
      .select()
      .from(processStageStates)
      .where(
        and(eq(processStageStates.orgId, ctx.orgId), eq(processStageStates.processId, processId)),
      )
      .orderBy(asc(processStageStates.stageKey)),
  );
}

async function upsertStageState(
  tx: Tx,
  ctx: OrgContext,
  processId: string,
  stageKey: string,
  patch: Partial<{
    state: "pendente" | "em_andamento" | "concluida";
    assignedTo: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
  }>,
) {
  await tx
    .insert(processStageStates)
    .values({ orgId: ctx.orgId, processId, stageKey, ...patch })
    .onConflictDoUpdate({
      target: [processStageStates.processId, processStageStates.stageKey],
      set: { ...patch, updatedAt: new Date() },
    });
}

export async function startStage(ctx: OrgContext, processId: string, stageKey: string) {
  return withOrg(ctx, async (tx) => {
    await upsertStageState(tx, ctx, processId, stageKey, {
      state: "em_andamento",
      startedAt: new Date(),
      finishedAt: null,
    });
    await recordProcessEvent(tx, ctx, processId, "etapa_iniciada", { newValue: stageKey });
  });
}

export async function finishStage(ctx: OrgContext, processId: string, stageKey: string) {
  return withOrg(ctx, async (tx) => {
    await upsertStageState(tx, ctx, processId, stageKey, {
      state: "concluida",
      finishedAt: new Date(),
    });
    await recordProcessEvent(tx, ctx, processId, "etapa_finalizada", { newValue: stageKey });
  });
}

export async function assignStage(
  ctx: OrgContext,
  processId: string,
  stageKey: string,
  userId: string | null,
) {
  return withOrg(ctx, async (tx) => {
    await upsertStageState(tx, ctx, processId, stageKey, { assignedTo: userId });
    await recordProcessEvent(tx, ctx, processId, "responsavel_alterado", {
      fieldKey: stageKey,
      newValue: userId,
    });
  });
}
