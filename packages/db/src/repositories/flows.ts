import {
  type FieldBlock,
  type FlowDef,
  type OrgContext,
  type StageRequirement,
  DEFAULT_FLOW,
  NotFoundError,
  validateFlow,
} from "@corr/core";
import { and, asc, eq } from "drizzle-orm";
import { withOrg, type Tx } from "../client";
import { flowStages, flows } from "../schema/flows";

export interface StageConfig {
  id: string;
  key: string;
  label: string;
  position: number;
  blocks: FieldBlock[];
  requirements: StageRequirement[];
}

export interface FlowConfig {
  id: string;
  key: string;
  name: string;
  isDefault: boolean;
  stages: StageConfig[];
}

async function insertFlow(tx: Tx, orgId: string, def: FlowDef, isDefault: boolean) {
  validateFlow(def);

  const [flow] = await tx
    .insert(flows)
    .values({ orgId, key: def.key, name: def.name, isDefault })
    .returning();

  if (!flow) throw new Error("Falha ao criar o fluxo.");

  await tx.insert(flowStages).values(
    def.stages.map((stage, index) => ({
      orgId,
      flowId: flow.id,
      key: stage.key,
      label: stage.label,
      position: index,
      blocks: stage.blocks,
      requirements: stage.requirements ?? [],
    })),
  );

  return flow;
}

/**
 * Garante que o escritório tenha o fluxo padrão.
 *
 * É uma cópia, não uma referência: a partir daqui o escritório edita o fluxo
 * dele sem que uma mudança no código do fluxo padrão altere processos que já
 * estão correndo.
 */
export async function ensureDefaultFlow(ctx: OrgContext): Promise<string> {
  return withOrg(ctx, async (tx) => {
    const [existing] = await tx
      .select({ id: flows.id })
      .from(flows)
      .where(and(eq(flows.orgId, ctx.orgId), eq(flows.isDefault, true)))
      .limit(1);

    if (existing) return existing.id;

    const flow = await insertFlow(tx, ctx.orgId, DEFAULT_FLOW, true);
    return flow.id;
  });
}

export async function getFlowConfig(ctx: OrgContext, flowId: string): Promise<FlowConfig> {
  return withOrg(ctx, async (tx) => {
    const [flow] = await tx
      .select()
      .from(flows)
      .where(and(eq(flows.orgId, ctx.orgId), eq(flows.id, flowId)))
      .limit(1);

    if (!flow) throw new NotFoundError("Fluxo");

    const stages = await tx
      .select()
      .from(flowStages)
      .where(and(eq(flowStages.orgId, ctx.orgId), eq(flowStages.flowId, flowId)))
      .orderBy(asc(flowStages.position));

    return {
      id: flow.id,
      key: flow.key,
      name: flow.name,
      isDefault: flow.isDefault,
      stages: stages.map((stage) => ({
        id: stage.id,
        key: stage.key,
        label: stage.label,
        position: stage.position,
        blocks: stage.blocks,
        requirements: stage.requirements,
      })),
    };
  });
}

/**
 * Fluxo de um processo: o dele, ou o padrão do escritório quando o processo é
 * anterior à configuração de fluxos (coluna `flow_id` nula).
 */
export async function getFlowForProcess(
  ctx: OrgContext,
  flowId: string | null,
): Promise<FlowConfig> {
  const id = flowId ?? (await ensureDefaultFlow(ctx));
  return getFlowConfig(ctx, id);
}

export async function listFlows(ctx: OrgContext) {
  return withOrg(ctx, (tx) =>
    tx
      .select({ id: flows.id, key: flows.key, name: flows.name, isDefault: flows.isDefault })
      .from(flows)
      .where(eq(flows.orgId, ctx.orgId))
      .orderBy(asc(flows.name)),
  );
}

/**
 * Recria o fluxo padrão a partir do código.
 *
 * Existe para o seed de desenvolvimento: o fluxo de um escritório é cópia dele
 * e não deve ser sobrescrito por mudança no código — em produção, alterar o
 * fluxo padrão jamais pode apagar a configuração que o escritório ajustou.
 * Só processos sem `flow_id` sobrevivem a isto, que é o caso do seed.
 */
export async function resetDefaultFlow(ctx: OrgContext): Promise<string> {
  return withOrg(ctx, async (tx) => {
    await tx.delete(flows).where(and(eq(flows.orgId, ctx.orgId), eq(flows.isDefault, true)));
    const flow = await insertFlow(tx, ctx.orgId, DEFAULT_FLOW, true);
    return flow.id;
  });
}
