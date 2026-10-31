import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseFieldPatch, personInputSchema, processInputSchema } from "@corr/core";
import { CPFS_VALIDOS, createTestOrg, destroyTestOrg, type TestOrg } from "../testing/fixtures";
import { createPerson } from "./people";
import { createProcess, getProcess, moveProcessToStep, setProcessStatus } from "./processes";
import { ensureDefaultFlow, getFlowForProcess } from "./flows";
import {
  applyProcessPatch,
  finishStage,
  getProcessFieldValues,
  listProcessEvents,
  listStageStates,
  startStage,
} from "./process-fields";

let org: TestOrg;
let outraOrg: TestOrg;
let processId: string;

function patch(raw: Record<string, unknown>) {
  const { values, errors } = parseFieldPatch(raw, Object.keys(raw));
  expect(errors).toEqual({});
  return values;
}

beforeAll(async () => {
  org = await createTestOrg("audit-a");
  outraOrg = await createTestOrg("audit-b");

  const person = await createPerson(
    org.ctx,
    personInputSchema.parse({ cpf: CPFS_VALIDOS[0], fullName: "Ana Paula Ribeiro" }),
  );
  const process = await createProcess(org.ctx, processInputSchema.parse({ personId: person.id }));
  processId = process.id;
});

afterAll(async () => {
  await destroyTestOrg(org);
  await destroyTestOrg(outraOrg);
});

describe("auditoria campo-a-campo", () => {
  it("grava valor em coluna nativa e registra o de → para", async () => {
    const { changes } = await applyProcessPatch(
      org.ctx,
      processId,
      patch({ "process.property_value": "R$ 350.000,00" }),
    );

    expect(changes).toEqual([
      { key: "process.property_value", from: null, to: 35000000 },
    ]);

    const process = await getProcess(org.ctx, processId);
    expect(process.propertyValueCents).toBe(35000000);

    const [evento] = await listProcessEvents(org.ctx, processId);
    expect(evento).toMatchObject({
      kind: "campo_alterado",
      fieldKey: "process.property_value",
      oldValue: null,
      newValue: "35000000",
      actorId: org.userId,
    });
  });

  it("grava campo sem coluna nativa na tabela de valores", async () => {
    await applyProcessPatch(
      org.ctx,
      processId,
      patch({ "credit.installment_value": "2.500,00", "agency.manager_name": "Gerente Teste" }),
    );

    const valores = await getProcessFieldValues(org.ctx, processId);
    expect(valores["credit.installment_value"]).toBe("250000");
    expect(valores["agency.manager_name"]).toBe("Gerente Teste");
  });

  it("salvar sem mudança nenhuma não gera evento", async () => {
    const antes = await listProcessEvents(org.ctx, processId);

    const { changes } = await applyProcessPatch(
      org.ctx,
      processId,
      patch({ "process.property_value": "350000,00" }),
    );

    expect(changes).toEqual([]);
    const depois = await listProcessEvents(org.ctx, processId);
    expect(depois).toHaveLength(antes.length);
  });

  it("alteração seguinte guarda o valor anterior, não o vazio", async () => {
    await applyProcessPatch(
      org.ctx,
      processId,
      patch({ "process.property_value": "R$ 400.000,00" }),
    );

    const [evento] = await listProcessEvents(org.ctx, processId);
    expect(evento).toMatchObject({
      fieldKey: "process.property_value",
      oldValue: "35000000",
      newValue: "40000000",
    });
  });

  it("apagar um campo também entra no histórico", async () => {
    await applyProcessPatch(org.ctx, processId, patch({ "agency.manager_name": "" }));

    const [evento] = await listProcessEvents(org.ctx, processId);
    expect(evento).toMatchObject({
      fieldKey: "agency.manager_name",
      oldValue: "Gerente Teste",
      newValue: null,
    });
  });

  it("um patch com vários campos gera um evento por campo", async () => {
    const antes = (await listProcessEvents(org.ctx, processId)).length;

    await applyProcessPatch(
      org.ctx,
      processId,
      patch({ "process.indexer": "TR", "process.term_months": "360" }),
    );

    const depois = await listProcessEvents(org.ctx, processId);
    expect(depois.length - antes).toBe(2);
  });

  it("mudança de etapa e de status viram eventos próprios", async () => {
    await moveProcessToStep(org.ctx, processId, "revisao_gerente");
    await setProcessStatus(org.ctx, processId, "aprovado");

    const eventos = await listProcessEvents(org.ctx, processId);
    expect(eventos[1]).toMatchObject({
      kind: "andamento_alterado",
      oldValue: "captacao",
      newValue: "revisao_gerente",
    });
    expect(eventos[0]).toMatchObject({
      kind: "status_alterado",
      oldValue: "em_aberto",
      newValue: "aprovado",
    });
    // A tela de campos acompanha a etapa sem virar evento à parte.
    expect((await getProcess(org.ctx, processId)).stage).toBe("agencia");
  });

  it("criação do processo é o evento mais antigo", async () => {
    const eventos = await listProcessEvents(org.ctx, processId);
    expect(eventos.at(-1)).toMatchObject({ kind: "processo_criado" });
  });

  it("iniciar e finalizar etapa registra estado e evento", async () => {
    await startStage(org.ctx, processId, "cadastro");
    let estados = await listStageStates(org.ctx, processId);
    expect(estados.find((e) => e.stageKey === "cadastro")).toMatchObject({
      state: "em_andamento",
    });

    await finishStage(org.ctx, processId, "cadastro");
    estados = await listStageStates(org.ctx, processId);
    const cadastro = estados.find((e) => e.stageKey === "cadastro");
    expect(cadastro?.state).toBe("concluida");
    expect(cadastro?.finishedAt).toBeTruthy();

    const [evento] = await listProcessEvents(org.ctx, processId);
    expect(evento).toMatchObject({ kind: "etapa_finalizada", newValue: "cadastro" });
  });

  it("o histórico de um escritório não vaza para o outro", async () => {
    const eventos = await listProcessEvents(outraOrg.ctx, processId);
    expect(eventos).toEqual([]);
  });

  it("escrever num processo de outro escritório é recusado", async () => {
    await expect(
      applyProcessPatch(outraOrg.ctx, processId, patch({ "process.indexer": "IPCA" })),
    ).rejects.toThrow(/não encontrad/i);
  });
});

describe("fluxo do escritório", () => {
  it("cria o fluxo padrão uma vez só", async () => {
    const primeiro = await ensureDefaultFlow(org.ctx);
    const segundo = await ensureDefaultFlow(org.ctx);
    expect(primeiro).toBe(segundo);
  });

  it("entrega as fases configuradas, com blocos e campos", async () => {
    const flow = await getFlowForProcess(org.ctx, null);

    expect(flow.stages.map((s) => s.key)).toEqual([
      "cadastro",
      "correspondente",
      "montagem",
      "conformidade_contrato",
      "agencia",
      "cri",
    ]);
    expect(flow.stages[0]?.blocks[0]?.fields).toContain("process.bank");
  });

  it("cada escritório tem a própria cópia do fluxo", async () => {
    const daOrg = await ensureDefaultFlow(org.ctx);
    const daOutra = await ensureDefaultFlow(outraOrg.ctx);
    expect(daOrg).not.toBe(daOutra);
  });
});
