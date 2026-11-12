import { type OrgContext, type SimulationInput, NotFoundError } from "@corr/core";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { withOrg, type Tx } from "../client";
import { processes } from "../schema/processes";
import { simulations, type SimulationScenario } from "../schema/simulations";

export async function listSimulations(ctx: OrgContext, options: { search?: string } = {}) {
  const search = options.search?.trim();
  const digits = search?.replace(/\D/g, "") ?? "";
  const filtro = search
    ? or(
        ilike(simulations.clientName, `%${search}%`),
        digits.length >= 4
          ? sql`regexp_replace(coalesce(${simulations.clientPhone}, ''), '[^0-9]', '', 'g') like ${`%${digits}%`}`
          : undefined,
      )
    : undefined;
  return withOrg(ctx, (tx) =>
    tx
      .select({
        id: simulations.id,
        clientName: simulations.clientName,
        clientPhone: simulations.clientPhone,
        familyIncomeCents: simulations.familyIncomeCents,
        propertyValueCents: simulations.propertyValueCents,
        processId: simulations.processId,
        processNumber: processes.number,
        createdAt: simulations.createdAt,
        updatedAt: simulations.updatedAt,
      })
      .from(simulations)
      .leftJoin(processes, eq(processes.id, simulations.processId))
      .where(filtro ? and(eq(simulations.orgId, ctx.orgId), filtro) : eq(simulations.orgId, ctx.orgId))
      .orderBy(desc(simulations.updatedAt))
      .limit(200),
  );
}

export async function getSimulation(ctx: OrgContext, simulationId: string) {
  return withOrg(ctx, async (tx) => {
    const [row] = await tx
      .select()
      .from(simulations)
      .where(and(eq(simulations.orgId, ctx.orgId), eq(simulations.id, simulationId)))
      .limit(1);
    if (!row) throw new NotFoundError("Simulação");
    return row;
  });
}

/** Simulação de onde o processo nasceu, se houver. */
export async function getProcessSimulation(ctx: OrgContext, processId: string) {
  return withOrg(ctx, async (tx) => {
    const [row] = await tx
      .select()
      .from(simulations)
      .where(and(eq(simulations.orgId, ctx.orgId), eq(simulations.processId, processId)))
      .limit(1);
    return row ?? null;
  });
}

export async function createSimulation(ctx: OrgContext, input: SimulationInput) {
  return withOrg(ctx, async (tx) => {
    const [row] = await tx
      .insert(simulations)
      .values({ ...input, orgId: ctx.orgId, createdBy: ctx.userId })
      .returning({ id: simulations.id });
    if (!row) throw new Error("Falha ao gravar a simulação.");
    return row;
  });
}

export async function updateSimulation(ctx: OrgContext, simulationId: string, input: SimulationInput) {
  return withOrg(ctx, async (tx) => {
    const [row] = await tx
      .update(simulations)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(simulations.orgId, ctx.orgId), eq(simulations.id, simulationId)))
      .returning({ id: simulations.id });
    if (!row) throw new NotFoundError("Simulação");
    return row;
  });
}

/**
 * Liga a simulação ao processo que nasceu dela e leva o que foi simulado:
 * valor do imóvel e o cenário escolhido viram os valores iniciais da proposta.
 */
export async function attachSimulationToProcess(
  tx: Tx,
  ctx: OrgContext,
  simulationId: string,
  processId: string,
) {
  const [simulation] = await tx
    .select()
    .from(simulations)
    .where(and(eq(simulations.orgId, ctx.orgId), eq(simulations.id, simulationId)))
    .limit(1);
  if (!simulation) throw new NotFoundError("Simulação");

  const chosen: SimulationScenario | undefined =
    simulation.scenarios.find((scenario) => scenario.chosen) ?? simulation.scenarios[0];

  await tx
    .update(processes)
    .set({
      propertyValueCents: simulation.propertyValueCents,
      financedValueCents: chosen?.financedValueCents ?? null,
      termMonths: chosen?.termMonths ?? null,
      amortizationSystem: (chosen?.amortization as "price" | "sac" | null | undefined) ?? null,
      subsidyCents: chosen?.subsidyCents ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(processes.orgId, ctx.orgId), eq(processes.id, processId)));

  await tx
    .update(simulations)
    .set({ processId, updatedAt: new Date() })
    .where(and(eq(simulations.orgId, ctx.orgId), eq(simulations.id, simulationId)));
}

/**
 * Exclui a simulação. O processo que nasceu dela continua igual: só perde a
 * linha "Nasceu da simulação de...".
 */
export async function deleteSimulation(ctx: OrgContext, simulationId: string) {
  return withOrg(ctx, async (tx) => {
    const deleted = await tx
      .delete(simulations)
      .where(and(eq(simulations.orgId, ctx.orgId), eq(simulations.id, simulationId)))
      .returning({ id: simulations.id });
    if (deleted.length === 0) throw new NotFoundError("Simulação");
  });
}
