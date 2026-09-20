import {
  type OrgContext,
  type ProcessInput,
  type ProcessStage,
  type ProcessStatus,
  type ParticipantRole,
  CLOSED_STATUSES,
  NotFoundError,
  PROCESS_STAGES,
} from "@corr/core";
import { and, asc, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { withOrg, type Tx } from "../client";
import { orgCounters, profiles } from "../schema/orgs";
import { agencies, banks, brokers } from "../schema/catalogs";
import { people } from "../schema/people";
import { processParticipants, processes } from "../schema/processes";
import { recordProcessEvent } from "./process-fields";

/**
 * Próximo número do processo no escritório.
 *
 * O `update ... returning` trava a linha do contador, então dois cadastros
 * simultâneos entram na fila em vez de brigarem pelo mesmo número. O `insert`
 * antes cobre escritórios criados antes desta tabela existir.
 */
async function nextProcessNumber(tx: Tx, orgId: string): Promise<number> {
  await tx.insert(orgCounters).values({ orgId }).onConflictDoNothing();

  const [row] = await tx
    .update(orgCounters)
    .set({ nextProcessNumber: sql`${orgCounters.nextProcessNumber} + 1` })
    .where(eq(orgCounters.orgId, orgId))
    .returning({ next: orgCounters.nextProcessNumber });

  if (!row) throw new Error("Falha ao gerar o número do processo.");
  return row.next - 1;
}

const listSelection = {
  id: processes.id,
  number: processes.number,
  stage: processes.stage,
  status: processes.status,
  modality: processes.modality,
  propertyValueCents: processes.propertyValueCents,
  financedValueCents: processes.financedValueCents,
  creditValidUntil: processes.creditValidUntil,
  updatedAt: processes.updatedAt,
  createdAt: processes.createdAt,
  personId: people.id,
  personName: people.fullName,
  personCpf: people.cpf,
  bankShortName: banks.shortName,
  agencyName: agencies.name,
  brokerName: brokers.name,
  assignedToName: profiles.fullName,
} as const;

function baseQuery(tx: Tx) {
  return tx
    .select(listSelection)
    .from(processes)
    .innerJoin(people, eq(people.id, processes.personId))
    .leftJoin(banks, eq(banks.id, processes.bankId))
    .leftJoin(agencies, eq(agencies.id, processes.agencyId))
    .leftJoin(brokers, eq(brokers.id, processes.brokerId))
    .leftJoin(profiles, eq(profiles.id, processes.assignedTo));
}

export interface ListProcessesOptions {
  stage?: ProcessStage;
  status?: ProcessStatus;
  /** Por padrão a listagem esconde reprovados, cancelados e concluídos. */
  includeClosed?: boolean;
}

export async function listProcesses(ctx: OrgContext, options: ListProcessesOptions = {}) {
  return withOrg(ctx, async (tx) => {
    const filters = [eq(processes.orgId, ctx.orgId)];
    if (options.stage) filters.push(eq(processes.stage, options.stage));
    if (options.status) filters.push(eq(processes.status, options.status));
    else if (!options.includeClosed) {
      filters.push(notInArray(processes.status, [...CLOSED_STATUSES]));
    }

    return baseQuery(tx)
      .where(and(...filters))
      .orderBy(desc(processes.updatedAt));
  });
}

export type ProcessListRow = Awaited<ReturnType<typeof listProcesses>>[number];

export interface StageColumn {
  stage: ProcessStage;
  processes: ProcessListRow[];
}

/** Processos agrupados por fase, na ordem do funil — formato que o Kanban usa. */
export async function listProcessesByStage(
  ctx: OrgContext,
  options: ListProcessesOptions = {},
): Promise<StageColumn[]> {
  const rows = await listProcesses(ctx, options);

  return PROCESS_STAGES.map((stage) => ({
    stage,
    processes: rows.filter((row) => row.stage === stage),
  }));
}

export async function getProcess(ctx: OrgContext, processId: string) {
  return withOrg(ctx, async (tx) => {
    const [process] = await tx
      .select()
      .from(processes)
      .where(and(eq(processes.orgId, ctx.orgId), eq(processes.id, processId)))
      .limit(1);
    if (!process) throw new NotFoundError("Processo");

    const participants = await tx
      .select({
        personId: people.id,
        fullName: people.fullName,
        cpf: people.cpf,
        role: processParticipants.role,
      })
      .from(processParticipants)
      .innerJoin(people, eq(people.id, processParticipants.personId))
      .where(
        and(eq(processParticipants.orgId, ctx.orgId), eq(processParticipants.processId, processId)),
      )
      .orderBy(asc(processParticipants.role));

    return { ...process, participants };
  });
}

export async function createProcess(ctx: OrgContext, input: ProcessInput) {
  return withOrg(ctx, async (tx) => {
    const number = await nextProcessNumber(tx, ctx.orgId);

    const [created] = await tx
      .insert(processes)
      .values({ ...input, orgId: ctx.orgId, number, createdBy: ctx.userId })
      .returning();

    if (!created) throw new Error("Falha ao criar o processo.");

    // O proponente principal também entra na lista de participantes, para a
    // aba de pessoas do processo não precisar tratar um caso especial.
    await tx
      .insert(processParticipants)
      .values({
        orgId: ctx.orgId,
        processId: created.id,
        personId: input.personId,
        role: "proponente",
      })
      .onConflictDoNothing();

    await recordProcessEvent(tx, ctx, created.id, "processo_criado", {
      newValue: String(created.number),
    });

    return created;
  });
}

/*
 * Não existe `updateProcess` genérico de propósito.
 *
 * Edição de campo passa por `applyProcessPatch`, que calcula o diff e grava o
 * histórico. Um segundo caminho de escrita direto na tabela abriria um buraco
 * silencioso na auditoria — alterações que ninguém consegue explicar depois.
 */

export async function moveProcessToStage(ctx: OrgContext, processId: string, stage: ProcessStage) {
  return withOrg(ctx, async (tx) => {
    const [before] = await tx
      .select({ stage: processes.stage })
      .from(processes)
      .where(and(eq(processes.orgId, ctx.orgId), eq(processes.id, processId)))
      .limit(1);
    if (!before) throw new NotFoundError("Processo");
    if (before.stage === stage) return { id: processId, stage };

    const [updated] = await tx
      .update(processes)
      .set({ stage, updatedAt: new Date() })
      .where(and(eq(processes.orgId, ctx.orgId), eq(processes.id, processId)))
      .returning({ id: processes.id, stage: processes.stage });
    if (!updated) throw new NotFoundError("Processo");

    await recordProcessEvent(tx, ctx, processId, "fase_alterada", {
      oldValue: before.stage,
      newValue: stage,
    });

    return updated;
  });
}

export async function setProcessStatus(
  ctx: OrgContext,
  processId: string,
  status: ProcessStatus,
) {
  return withOrg(ctx, async (tx) => {
    const [before] = await tx
      .select({ status: processes.status })
      .from(processes)
      .where(and(eq(processes.orgId, ctx.orgId), eq(processes.id, processId)))
      .limit(1);
    if (!before) throw new NotFoundError("Processo");
    if (before.status === status) return { id: processId, status };

    const [updated] = await tx
      .update(processes)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(processes.orgId, ctx.orgId), eq(processes.id, processId)))
      .returning({ id: processes.id, status: processes.status });
    if (!updated) throw new NotFoundError("Processo");

    await recordProcessEvent(tx, ctx, processId, "status_alterado", {
      oldValue: before.status,
      newValue: status,
    });

    return updated;
  });
}

/** Totais por status para os cards do painel. */
export async function summarizeProcesses(ctx: OrgContext) {
  return withOrg(ctx, async (tx) => {
    const rows = await tx
      .select({
        status: processes.status,
        quantity: sql<number>`count(*)::int`,
        totalCents: sql<string>`coalesce(sum(${processes.financedValueCents}), 0)`,
      })
      .from(processes)
      .where(eq(processes.orgId, ctx.orgId))
      .groupBy(processes.status);

    return rows.map((row) => ({
      status: row.status,
      quantity: row.quantity,
      totalCents: Number(row.totalCents),
    }));
  });
}

/** Processos com crédito vencendo em até `days` dias — alerta do painel. */
export async function listExpiringProcesses(ctx: OrgContext, days = 30) {
  return withOrg(ctx, (tx) =>
    baseQuery(tx)
      .where(
        and(
          eq(processes.orgId, ctx.orgId),
          notInArray(processes.status, [...CLOSED_STATUSES]),
          sql`${processes.creditValidUntil} is not null`,
          sql`${processes.creditValidUntil} <= current_date + make_interval(days => ${days})`,
        ),
      )
      .orderBy(asc(processes.creditValidUntil)),
  );
}

export async function addParticipant(
  ctx: OrgContext,
  processId: string,
  personId: string,
  role: ParticipantRole,
) {
  return withOrg(ctx, async (tx) => {
    await tx
      .insert(processParticipants)
      .values({ orgId: ctx.orgId, processId, personId, role })
      .onConflictDoNothing();
  });
}

export async function removeParticipant(
  ctx: OrgContext,
  processId: string,
  personId: string,
  role: ParticipantRole,
) {
  return withOrg(ctx, async (tx) => {
    await tx
      .delete(processParticipants)
      .where(
        and(
          eq(processParticipants.orgId, ctx.orgId),
          eq(processParticipants.processId, processId),
          eq(processParticipants.personId, personId),
          eq(processParticipants.role, role),
        ),
      );
  });
}

/** Processos em que a pessoa aparece, em qualquer papel. */
export async function listProcessesForPerson(ctx: OrgContext, personId: string) {
  return withOrg(ctx, async (tx) => {
    const ids = await tx
      .select({ processId: processParticipants.processId })
      .from(processParticipants)
      .where(
        and(eq(processParticipants.orgId, ctx.orgId), eq(processParticipants.personId, personId)),
      );

    if (ids.length === 0) return [];

    return baseQuery(tx)
      .where(
        and(
          eq(processes.orgId, ctx.orgId),
          inArray(
            processes.id,
            ids.map((row) => row.processId),
          ),
        ),
      )
      .orderBy(desc(processes.updatedAt));
  });
}

export interface AgrupamentoDoPainel {
  label: string;
  quantity: number;
  totalCents: number;
}

/**
 * Volume por banco, modalidade e fase.
 *
 * Soma no banco de dados, não na aplicação: trazer todos os processos para
 * somar em memória funciona com cem e some com dez mil.
 */
export async function summarizeByBank(ctx: OrgContext): Promise<AgrupamentoDoPainel[]> {
  return withOrg(ctx, async (tx) => {
    const rows = await tx
      .select({
        label: sql<string>`coalesce(${banks.shortName}, 'Sem banco')`,
        quantity: sql<number>`count(*)::int`,
        totalCents: sql<string>`coalesce(sum(${processes.financedValueCents}), 0)`,
      })
      .from(processes)
      .leftJoin(banks, eq(banks.id, processes.bankId))
      .where(
        and(
          eq(processes.orgId, ctx.orgId),
          notInArray(processes.status, [...CLOSED_STATUSES]),
        ),
      )
      .groupBy(sql`coalesce(${banks.shortName}, 'Sem banco')`)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({ ...row, totalCents: Number(row.totalCents) }));
  });
}

export async function summarizeByModality(ctx: OrgContext): Promise<AgrupamentoDoPainel[]> {
  return withOrg(ctx, async (tx) => {
    const rows = await tx
      .select({
        label: sql<string>`coalesce(${processes.modality}::text, 'sem_modalidade')`,
        quantity: sql<number>`count(*)::int`,
        totalCents: sql<string>`coalesce(sum(${processes.financedValueCents}), 0)`,
      })
      .from(processes)
      .where(
        and(
          eq(processes.orgId, ctx.orgId),
          notInArray(processes.status, [...CLOSED_STATUSES]),
        ),
      )
      .groupBy(sql`coalesce(${processes.modality}::text, 'sem_modalidade')`)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({ ...row, totalCents: Number(row.totalCents) }));
  });
}

export async function summarizeByStage(ctx: OrgContext): Promise<AgrupamentoDoPainel[]> {
  return withOrg(ctx, async (tx) => {
    const rows = await tx
      .select({
        label: sql<string>`${processes.stage}::text`,
        quantity: sql<number>`count(*)::int`,
        totalCents: sql<string>`coalesce(sum(${processes.financedValueCents}), 0)`,
      })
      .from(processes)
      .where(
        and(
          eq(processes.orgId, ctx.orgId),
          notInArray(processes.status, [...CLOSED_STATUSES]),
        ),
      )
      .groupBy(processes.stage);

    const porFase = new Map(rows.map((row) => [row.label, row]));

    // Fase vazia continua na lista: um funil com buraco escondido engana quem
    // olha, porque some justamente a etapa onde nada está entrando.
    return PROCESS_STAGES.map((stage) => {
      const row = porFase.get(stage);
      return {
        label: stage,
        quantity: row?.quantity ?? 0,
        totalCents: Number(row?.totalCents ?? 0),
      };
    });
  });
}
