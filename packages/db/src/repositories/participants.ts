import {
  type OrgContext,
  type OtherParticipantRole,
  type ParticipantRole,
  type ProcessCreateInput,
  DomainError,
  NotFoundError,
  PROPONENT_ROLES,
} from "@corr/core";
import { and, eq, inArray, sql } from "drizzle-orm";
import { withOrg, type Tx } from "../client";
import { brokers, realEstateAgencies } from "../schema/catalogs";
import { personIncomes } from "../schema/people";
import { processParticipants, processes } from "../schema/processes";
import { insertProcess } from "./processes";
import { linkCurrentRiskAssessment } from "./risk-assessments";

/** Renda bruta somada de cada pessoa, numa consulta só. */
export async function grossIncomeByPerson(
  tx: Tx,
  ctx: OrgContext,
  personIds: string[],
): Promise<Map<string, number>> {
  if (personIds.length === 0) return new Map();
  const rows = await tx
    .select({
      personId: personIncomes.personId,
      total: sql<string>`coalesce(sum(${personIncomes.grossCents}), 0)`,
    })
    .from(personIncomes)
    .where(and(eq(personIncomes.orgId, ctx.orgId), inArray(personIncomes.personId, personIds)))
    .groupBy(personIncomes.personId);
  return new Map(rows.map((row) => [row.personId, Number(row.total)]));
}

/** Para a tela de abertura mostrar a renda ao lado de cada nome. */
export async function listGrossIncomes(ctx: OrgContext, personIds: string[]) {
  return withOrg(ctx, (tx) => grossIncomeByPerson(tx, ctx, personIds));
}

/**
 * Reordena os proponentes: o de maior renda vira o principal.
 *
 * É a regra da Caixa — o primeiro proponente é o de maior renda — e roda a
 * cada mudança (proponente entra, sai, renda nova), então ninguém precisa
 * lembrar de trocar à mão. Empate mantém o principal atual.
 */
export async function reorderProponents(tx: Tx, ctx: OrgContext, processId: string) {
  const [process] = await tx
    .select({ personId: processes.personId })
    .from(processes)
    .where(and(eq(processes.orgId, ctx.orgId), eq(processes.id, processId)))
    .limit(1);
  if (!process) throw new NotFoundError("Processo");

  const rows = await tx
    .select({ personId: processParticipants.personId })
    .from(processParticipants)
    .where(
      and(
        eq(processParticipants.orgId, ctx.orgId),
        eq(processParticipants.processId, processId),
        inArray(processParticipants.role, [...PROPONENT_ROLES]),
      ),
    );
  const ids = [...new Set(rows.map((row) => row.personId))];
  if (ids.length === 0) return;

  const income = await grossIncomeByPerson(tx, ctx, ids);
  const principal = ids.reduce((best, id) => {
    const diff = (income.get(id) ?? 0) - (income.get(best) ?? 0);
    return diff > 0 || (diff === 0 && id === process.personId) ? id : best;
  });

  await tx
    .delete(processParticipants)
    .where(
      and(
        eq(processParticipants.orgId, ctx.orgId),
        eq(processParticipants.processId, processId),
        inArray(processParticipants.role, [...PROPONENT_ROLES]),
      ),
    );
  await tx.insert(processParticipants).values(
    ids.map((personId) => ({
      orgId: ctx.orgId,
      processId,
      personId,
      role: (personId === principal ? "proponente" : "coproponente") as ParticipantRole,
    })),
  );

  if (principal !== process.personId) {
    await tx
      .update(processes)
      .set({ personId: principal, updatedAt: new Date() })
      .where(and(eq(processes.orgId, ctx.orgId), eq(processes.id, processId)));
    await linkCurrentRiskAssessment(tx, ctx, principal);
  }
}

/**
 * Abre um processo só com modalidade e participantes.
 *
 * Corretor e imobiliária novos (só o nome) entram no cadastro de parceiros na
 * mesma transação: o operador não precisa sair da tela para cadastrar antes.
 */
export async function createProcessWithParticipants(ctx: OrgContext, input: ProcessCreateInput) {
  return withOrg(ctx, async (tx) => {
    let brokerId = input.brokerId;
    if (!brokerId && input.newBrokerName) {
      const [broker] = await tx
        .insert(brokers)
        .values({ orgId: ctx.orgId, name: input.newBrokerName })
        .returning({ id: brokers.id });
      brokerId = broker?.id ?? null;
    }

    let realEstateAgencyId = input.realEstateAgencyId;
    if (!realEstateAgencyId && input.newRealEstateAgencyName) {
      const [agency] = await tx
        .insert(realEstateAgencies)
        .values({ orgId: ctx.orgId, name: input.newRealEstateAgencyName })
        .returning({ id: realEstateAgencies.id });
      realEstateAgencyId = agency?.id ?? null;
    }

    const [first, ...others] = input.proponentIds;
    if (!first) throw new DomainError("Informe pelo menos um proponente.", "no_proponent");

    const created = await insertProcess(tx, ctx, {
      personId: first,
      modality: input.modality,
      brokerId,
      realEstateAgencyId,
    });

    const extra = [
      ...others.map((personId) => ({ personId, role: "coproponente" as ParticipantRole })),
      ...input.participants,
    ];
    if (extra.length > 0) {
      await tx
        .insert(processParticipants)
        .values(extra.map((p) => ({ orgId: ctx.orgId, processId: created.id, ...p })))
        .onConflictDoNothing();
    }

    await reorderProponents(tx, ctx, created.id);
    return created;
  });
}

/** Proponente entra como "proponente" e o sistema decide se vira o principal. */
export type ParticipantChoice = "proponente" | OtherParticipantRole;

export async function addProcessParticipant(
  ctx: OrgContext,
  processId: string,
  personId: string,
  choice: ParticipantChoice,
) {
  return withOrg(ctx, async (tx) => {
    const role: ParticipantRole = choice === "proponente" ? "coproponente" : choice;
    await tx
      .insert(processParticipants)
      .values({ orgId: ctx.orgId, processId, personId, role })
      .onConflictDoNothing();
    if (choice === "proponente") await reorderProponents(tx, ctx, processId);
  });
}

export async function removeProcessParticipant(
  ctx: OrgContext,
  processId: string,
  personId: string,
  role: ParticipantRole,
) {
  return withOrg(ctx, async (tx) => {
    const isProponent = PROPONENT_ROLES.includes(role);
    if (isProponent) {
      const [row] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(processParticipants)
        .where(
          and(
            eq(processParticipants.orgId, ctx.orgId),
            eq(processParticipants.processId, processId),
            inArray(processParticipants.role, [...PROPONENT_ROLES]),
          ),
        );
      if ((row?.total ?? 0) <= 1) {
        throw new DomainError("O processo precisa de pelo menos um proponente.", "last_proponent");
      }
    }

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

    if (isProponent) await reorderProponents(tx, ctx, processId);
  });
}
