import {
  CLOSED_STATUSES,
  DomainError,
  NotFoundError,
  isHousingRiskAssessment,
  type OrgContext,
} from "@corr/core";
import { and, asc, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { type Tx, withOrg } from "../client";
import { people } from "../schema/people";
import { processParticipants, processes } from "../schema/processes";
import { riskAssessments } from "../schema/risk-assessments";
import { recordProcessEvent } from "./process-fields";

/** Uma linha da tela de formulários enviados, já com datas em ISO. */
export interface RiskAssessmentInput {
  proposalNumber: string;
  sentOn?: string | null;
  product?: string | null;
  conformity?: string | null;
  result?: string | null;
  details?: string | null;
  validUntil?: string | null;
  requestType?: string | null;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function dataOuNulo(valor: string | null | undefined): string | null {
  return valor && DATA_ISO.test(valor) ? valor : null;
}

function textoOuNulo(valor: string | null | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo.slice(0, 2000) : null;
}

/**
 * Grava as avaliações lidas da tela e vincula a mais recente aos processos
 * abertos da pessoa que ainda não têm nenhuma.
 *
 * A mesma proposta lida de novo atualiza a linha (o resultado sai de "em
 * análise" para "aprovada", a validade é prorrogada): o portal é a fonte, e a
 * leitura mais nova vale.
 */
export async function saveRiskAssessments(
  ctx: OrgContext,
  personId: string,
  rows: RiskAssessmentInput[],
) {
  return withOrg(ctx, async (tx) => {
    const validas = rows
      .map((row) => ({ ...row, proposalNumber: row.proposalNumber.replace(/\s+/g, "") }))
      .filter((row) => row.proposalNumber !== "");

    const existentes = new Set(
      validas.length === 0
        ? []
        : (
            await tx
              .select({ proposalNumber: riskAssessments.proposalNumber })
              .from(riskAssessments)
              .where(
                and(
                  eq(riskAssessments.orgId, ctx.orgId),
                  eq(riskAssessments.personId, personId),
                  inArray(
                    riskAssessments.proposalNumber,
                    validas.map((row) => row.proposalNumber),
                  ),
                ),
              )
          ).map((row) => row.proposalNumber),
    );

    const agora = new Date();
    for (const row of validas) {
      const valores = {
        sentOn: dataOuNulo(row.sentOn),
        product: textoOuNulo(row.product),
        conformity: textoOuNulo(row.conformity),
        result: textoOuNulo(row.result),
        details: textoOuNulo(row.details),
        validUntil: dataOuNulo(row.validUntil),
        requestType: textoOuNulo(row.requestType),
        housing: isHousingRiskAssessment(row),
        capturedAt: agora,
        capturedBy: ctx.userId,
      };
      await tx
        .insert(riskAssessments)
        .values({ orgId: ctx.orgId, personId, proposalNumber: row.proposalNumber, ...valores })
        .onConflictDoUpdate({
          target: [riskAssessments.orgId, riskAssessments.personId, riskAssessments.proposalNumber],
          set: { ...valores, updatedAt: agora },
        });
    }

    const linkedProcesses = await linkCurrentRiskAssessment(tx, ctx, personId);
    const added = validas.filter((row) => !existentes.has(row.proposalNumber)).length;
    return { added, updated: validas.length - added, linkedProcesses };
  });
}

/**
 * A avaliação que vale para a pessoa agora: entre as de habitação que ainda
 * não venceram (ou não dizem validade), a de remessa mais recente. CROT e
 * cartão nunca entram no processo sozinhas.
 */
async function avaliacaoVigente(tx: Tx, ctx: OrgContext, personId: string) {
  const [vigente] = await tx
    .select({ id: riskAssessments.id, proposalNumber: riskAssessments.proposalNumber })
    .from(riskAssessments)
    .where(
      and(
        eq(riskAssessments.orgId, ctx.orgId),
        eq(riskAssessments.personId, personId),
        eq(riskAssessments.housing, true),
        sql`(${riskAssessments.validUntil} is null or ${riskAssessments.validUntil} >= current_date)`,
      ),
    )
    .orderBy(sql`${riskAssessments.sentOn} desc nulls last`, desc(riskAssessments.capturedAt))
    .limit(1);
  return vigente ?? null;
}

/**
 * Vincula a avaliação vigente da pessoa aos processos abertos dela que ainda
 * não têm nenhuma. Roda na captura e na abertura de processo.
 *
 * Só preenche vazio: a escolha do operador nunca é trocada pela captura.
 */
export async function linkCurrentRiskAssessment(
  tx: Tx,
  ctx: OrgContext,
  personId: string,
): Promise<number[]> {
  const vigente = await avaliacaoVigente(tx, ctx, personId);
  if (!vigente) return [];

  const alvos = await tx
    .select({ id: processes.id, number: processes.number })
    .from(processes)
    .innerJoin(processParticipants, eq(processParticipants.processId, processes.id))
    .where(
      and(
        eq(processes.orgId, ctx.orgId),
        eq(processParticipants.personId, personId),
        isNull(processes.riskAssessmentId),
        notInArray(processes.status, [...CLOSED_STATUSES]),
      ),
    );

  const vinculados: number[] = [];
  for (const alvo of alvos) {
    if (vinculados.includes(alvo.number)) continue;
    await tx
      .update(processes)
      .set({ riskAssessmentId: vigente.id, updatedAt: new Date() })
      .where(and(eq(processes.orgId, ctx.orgId), eq(processes.id, alvo.id)));
    await recordProcessEvent(tx, ctx, alvo.id, "avaliacao_risco_vinculada", {
      newValue: vigente.proposalNumber,
    });
    vinculados.push(alvo.number);
  }
  return vinculados;
}

/** Avaliações das pessoas, mais recentes primeiro, com o nome de cada uma. */
export async function listRiskAssessmentsForPeople(ctx: OrgContext, personIds: string[]) {
  if (personIds.length === 0) return [];
  return withOrg(ctx, (tx) =>
    tx
      .select({
        id: riskAssessments.id,
        personId: riskAssessments.personId,
        personName: people.fullName,
        proposalNumber: riskAssessments.proposalNumber,
        sentOn: riskAssessments.sentOn,
        product: riskAssessments.product,
        conformity: riskAssessments.conformity,
        result: riskAssessments.result,
        details: riskAssessments.details,
        validUntil: riskAssessments.validUntil,
        requestType: riskAssessments.requestType,
        housing: riskAssessments.housing,
        capturedAt: riskAssessments.capturedAt,
      })
      .from(riskAssessments)
      .innerJoin(people, eq(people.id, riskAssessments.personId))
      .where(
        and(eq(riskAssessments.orgId, ctx.orgId), inArray(riskAssessments.personId, personIds)),
      )
      .orderBy(
        sql`${riskAssessments.sentOn} desc nulls last`,
        desc(riskAssessments.capturedAt),
        asc(riskAssessments.proposalNumber),
      ),
  );
}

export type RiskAssessmentRow = Awaited<ReturnType<typeof listRiskAssessmentsForPeople>>[number];

/**
 * Escolha manual da avaliação do processo (ou nenhuma). Só aceita avaliação de
 * habitação, e de quem participa do processo: a de outro cliente não tem nada
 * a ver com ele.
 */
export async function linkRiskAssessment(
  ctx: OrgContext,
  processId: string,
  assessmentId: string | null,
) {
  return withOrg(ctx, async (tx) => {
    const [processo] = await tx
      .select({ riskAssessmentId: processes.riskAssessmentId })
      .from(processes)
      .where(and(eq(processes.orgId, ctx.orgId), eq(processes.id, processId)))
      .limit(1);
    if (!processo) throw new NotFoundError("Processo");
    if (processo.riskAssessmentId === assessmentId) return;

    const numeroDe = async (id: string | null) => {
      if (!id) return null;
      const [linha] = await tx
        .select({
          proposalNumber: riskAssessments.proposalNumber,
          personId: riskAssessments.personId,
          housing: riskAssessments.housing,
        })
        .from(riskAssessments)
        .where(and(eq(riskAssessments.orgId, ctx.orgId), eq(riskAssessments.id, id)))
        .limit(1);
      return linha ?? null;
    };

    const nova = await numeroDe(assessmentId);
    if (assessmentId) {
      if (!nova) throw new NotFoundError("Avaliação de risco");
      if (!nova.housing) {
        throw new DomainError(
          "Só a avaliação de habitação vale para o processo; CROT e cartão ficam como extras.",
          "risk_assessment_not_housing",
        );
      }
      const [participa] = await tx
        .select({ personId: processParticipants.personId })
        .from(processParticipants)
        .where(
          and(
            eq(processParticipants.orgId, ctx.orgId),
            eq(processParticipants.processId, processId),
            eq(processParticipants.personId, nova.personId),
          ),
        )
        .limit(1);
      if (!participa) {
        throw new DomainError(
          "Esta avaliação é de uma pessoa que não participa do processo.",
          "risk_assessment_not_participant",
        );
      }
    }

    const anterior = await numeroDe(processo.riskAssessmentId);
    await tx
      .update(processes)
      .set({ riskAssessmentId: assessmentId, updatedAt: new Date() })
      .where(and(eq(processes.orgId, ctx.orgId), eq(processes.id, processId)));
    await recordProcessEvent(tx, ctx, processId, "avaliacao_risco_vinculada", {
      oldValue: anterior?.proposalNumber ?? null,
      newValue: nova?.proposalNumber ?? null,
    });
  });
}
