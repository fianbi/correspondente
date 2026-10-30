import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { personInputSchema, processInputSchema } from "@corr/core";
import { createTestOrg, destroyTestOrg, CPFS_VALIDOS, type TestOrg } from "../testing/fixtures";
import { createPerson } from "./people";
import { listProcessEvents } from "./process-fields";
import { createProcess, getProcess, setProcessStatus } from "./processes";
import {
  linkRiskAssessment,
  listRiskAssessmentsForPeople,
  saveRiskAssessments,
} from "./risk-assessments";

let orgA: TestOrg;
let orgB: TestOrg;
let ana: string;
let bruno: string;

async function novaPessoa(org: TestOrg, cpf: string, nome: string) {
  return (await createPerson(org.ctx, personInputSchema.parse({ cpf, fullName: nome }))).id;
}

const novoProcesso = (org: TestOrg, personId: string) =>
  createProcess(org.ctx, processInputSchema.parse({ personId }));

/** Validade sempre no futuro, para o teste não vencer com o calendário. */
const daquiAUmAno = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  orgA = await createTestOrg("risco-a");
  orgB = await createTestOrg("risco-b");
  ana = await novaPessoa(orgA, CPFS_VALIDOS[0], "Ana Paula Ribeiro");
  bruno = await novaPessoa(orgA, CPFS_VALIDOS[1], "Bruno Martins de Souza");
});

afterAll(async () => {
  await destroyTestOrg(orgA);
  await destroyTestOrg(orgB);
});

describe("avaliação de risco", () => {
  it("grava a leitura e vincula ao processo aberto sem avaliação", async () => {
    const processo = await novoProcesso(orgA, ana);
    const fechado = await novoProcesso(orgA, ana);
    await setProcessStatus(orgA.ctx, fechado.id, "cancelado");

    const resultado = await saveRiskAssessments(orgA.ctx, ana, [
      { proposalNumber: "100", sentOn: "2026-01-10", result: "VENCIDA", validUntil: "2026-02-10" },
      { proposalNumber: "200", sentOn: "2026-09-01", result: "APROVADA", validUntil: daquiAUmAno },
    ]);

    expect(resultado).toEqual({ added: 2, updated: 0, linkedProcesses: [processo.number] });
    const lido = await getProcess(orgA.ctx, processo.id);
    const avaliacoes = await listRiskAssessmentsForPeople(orgA.ctx, [ana]);
    expect(avaliacoes.find((a) => a.id === lido.riskAssessmentId)?.proposalNumber).toBe("200");
    expect((await getProcess(orgA.ctx, fechado.id)).riskAssessmentId).toBeNull();

    const eventos = await listProcessEvents(orgA.ctx, processo.id);
    expect(eventos.some((e) => e.kind === "avaliacao_risco_vinculada" && e.newValue === "200")).toBe(true);
  });

  it("a mesma proposta lida de novo atualiza, sem duplicar", async () => {
    const resultado = await saveRiskAssessments(orgA.ctx, ana, [
      { proposalNumber: "200", result: "CONDICIONADA", validUntil: daquiAUmAno },
    ]);
    expect(resultado.added).toBe(0);
    expect(resultado.updated).toBe(1);

    const avaliacoes = await listRiskAssessmentsForPeople(orgA.ctx, [ana]);
    expect(avaliacoes.filter((a) => a.proposalNumber === "200")).toHaveLength(1);
    expect(avaliacoes.find((a) => a.proposalNumber === "200")?.result).toBe("CONDICIONADA");
  });

  it("não troca a avaliação que o operador escolheu", async () => {
    const processo = await novoProcesso(orgA, ana);
    const [vencida] = (await listRiskAssessmentsForPeople(orgA.ctx, [ana])).filter(
      (a) => a.proposalNumber === "100",
    );
    // O processo novo nasceu sem avaliação; a escolha manual vale.
    await linkRiskAssessment(orgA.ctx, processo.id, vencida!.id);
    await saveRiskAssessments(orgA.ctx, ana, [{ proposalNumber: "300", validUntil: daquiAUmAno }]);

    expect((await getProcess(orgA.ctx, processo.id)).riskAssessmentId).toBe(vencida!.id);
  });

  it("processo aberto depois da avaliação já nasce com ela", async () => {
    const processo = await novoProcesso(orgA, ana);
    const lido = await getProcess(orgA.ctx, processo.id);
    const avaliacoes = await listRiskAssessmentsForPeople(orgA.ctx, [ana]);
    expect(avaliacoes.find((a) => a.id === lido.riskAssessmentId)?.proposalNumber).toBe("300");
  });

  it("recusa avaliação de quem não participa do processo", async () => {
    const processo = await novoProcesso(orgA, bruno);
    const [daAna] = await listRiskAssessmentsForPeople(orgA.ctx, [ana]);
    await expect(linkRiskAssessment(orgA.ctx, processo.id, daAna!.id)).rejects.toThrow(
      /não participa/,
    );
  });

  it("outro escritório não enxerga as avaliações", async () => {
    expect(await listRiskAssessmentsForPeople(orgB.ctx, [ana])).toEqual([]);
  });
});
