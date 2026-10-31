import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { personIncomeInputSchema, personInputSchema, processInputSchema } from "@corr/core";
import { createTestOrg, destroyTestOrg, CPFS_VALIDOS, type TestOrg } from "../testing/fixtures";
import { addPersonIncome, createPerson } from "./people";
import {
  addProcessParticipant,
  createProcessWithParticipants,
  removeProcessParticipant,
} from "./participants";
import { listBrokers } from "./catalogs";
import {
  createProcess,
  getProcess,
  listProcesses,
  currentStepOf,
  moveProcessToStep,
  summarizeProcesses,
} from "./processes";

let orgA: TestOrg;
let orgB: TestOrg;
let pessoaA1: string;
let pessoaA2: string;
let pessoaB1: string;

async function novaPessoa(org: TestOrg, cpf: string, nome: string) {
  const input = personInputSchema.parse({ cpf, fullName: nome });
  const person = await createPerson(org.ctx, input);
  return person.id;
}

function processInput(personId: string, extra: Record<string, unknown> = {}) {
  return processInputSchema.parse({ personId, ...extra });
}

beforeAll(async () => {
  orgA = await createTestOrg("proc-a");
  orgB = await createTestOrg("proc-b");
  pessoaA1 = await novaPessoa(orgA, CPFS_VALIDOS[0], "Ana Paula Ribeiro");
  pessoaA2 = await novaPessoa(orgA, CPFS_VALIDOS[1], "Bruno Martins de Souza");
  pessoaB1 = await novaPessoa(orgB, CPFS_VALIDOS[0], "Cliente do Outro Escritório");
});

afterAll(async () => {
  await destroyTestOrg(orgA);
  await destroyTestOrg(orgB);
});

describe("esteira de processos", () => {
  it("numera sequencialmente dentro do escritório", async () => {
    const primeiro = await createProcess(orgA.ctx, processInput(pessoaA1));
    const segundo = await createProcess(orgA.ctx, processInput(pessoaA2));

    expect(primeiro.number).toBe(1);
    expect(segundo.number).toBe(2);
  });

  it("cada escritório tem a própria numeração, começando do 1", async () => {
    const deB = await createProcess(orgB.ctx, processInput(pessoaB1));
    expect(deB.number).toBe(1);
  });

  it("numeração aguenta criações simultâneas sem repetir", async () => {
    // O contador é atualizado com `update ... returning`, então o lock de linha
    // serializa os concorrentes. Sem isso, dois processos sairiam com o mesmo
    // número e o unique(org_id, number) estouraria na cara do operador.
    const criados = await Promise.all(
      Array.from({ length: 5 }, () => createProcess(orgA.ctx, processInput(pessoaA1))),
    );

    const numeros = criados.map((p) => p.number);
    expect(new Set(numeros).size).toBe(numeros.length);
  });

  it("o proponente entra automaticamente como participante", async () => {
    const criado = await createProcess(orgA.ctx, processInput(pessoaA2));
    const completo = await getProcess(orgA.ctx, criado.id);

    expect(completo.participants).toEqual([
      expect.objectContaining({ personId: pessoaA2, role: "proponente" }),
    ]);
  });

  it("mover de etapa muda a etapa que a lista mostra", async () => {
    const criado = await createProcess(orgA.ctx, processInput(pessoaA1));
    const antes = (await listProcesses(orgA.ctx)).find((p) => p.id === criado.id);
    expect(antes && currentStepOf(antes).key).toBe("captacao");

    await moveProcessToStep(orgA.ctx, criado.id, "revisao_gerente");

    const depois = (await listProcesses(orgA.ctx)).find((p) => p.id === criado.id);
    expect(depois && currentStepOf(depois).key).toBe("revisao_gerente");
  });

  it("esconde processos encerrados por padrão", async () => {
    const criado = await createProcess(orgA.ctx, processInput(pessoaA1, { status: "cancelado" }));

    const padrao = await listProcesses(orgA.ctx);
    expect(padrao.map((p) => p.id)).not.toContain(criado.id);

    const comEncerrados = await listProcesses(orgA.ctx, { includeClosed: true });
    expect(comEncerrados.map((p) => p.id)).toContain(criado.id);
  });

  it("a listagem traz o nome do cliente sem consulta extra", async () => {
    const [primeiro] = await listProcesses(orgA.ctx);
    expect(primeiro?.personName).toBeTruthy();
    expect(primeiro?.personCpf).toBeTruthy();
  });

  it("um escritório não vê processo do outro", async () => {
    const deB = await listProcesses(orgB.ctx);
    const deA = await listProcesses(orgA.ctx);

    expect(deB).toHaveLength(1);
    expect(deA.map((p) => p.id)).not.toContain(deB[0]!.id);

    await expect(getProcess(orgA.ctx, deB[0]!.id)).rejects.toThrow(/não encontrad/i);
  });

  it("o resumo por status só soma o próprio escritório", async () => {
    const resumoB = await summarizeProcesses(orgB.ctx);
    const total = resumoB.reduce((acc, row) => acc + row.quantity, 0);
    expect(total).toBe(1);
  });

  it("abre com vários proponentes e põe como principal o de maior renda", async () => {
    await addPersonIncome(
      orgA.ctx,
      pessoaA2,
      personIncomeInputSchema.parse({ kind: "formal", grossCents: "9000" }),
    );
    await addPersonIncome(
      orgA.ctx,
      pessoaA1,
      personIncomeInputSchema.parse({ kind: "formal", grossCents: "3000" }),
    );

    const criado = await createProcessWithParticipants(orgA.ctx, {
      modality: "aquisicao_imovel_usado",
      proponentIds: [pessoaA1, pessoaA2],
      participants: [],
      brokerId: null,
      newBrokerName: "Corretor Novo de Teste",
      realEstateAgencyId: null,
      newRealEstateAgencyName: null,
    });
    const processo = await getProcess(orgA.ctx, criado.id);

    expect(processo.personId).toBe(pessoaA2);
    expect(processo.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ personId: pessoaA2, role: "proponente" }),
        expect.objectContaining({ personId: pessoaA1, role: "coproponente" }),
      ]),
    );
    // Corretor digitado na abertura entra no cadastro de parceiros.
    const corretores = await listBrokers(orgA.ctx);
    expect(corretores.find((c) => c.id === processo.brokerId)?.name).toBe("Corretor Novo de Teste");

    // Sai o principal: o outro proponente assume.
    await removeProcessParticipant(orgA.ctx, criado.id, pessoaA2, "proponente");
    expect((await getProcess(orgA.ctx, criado.id)).personId).toBe(pessoaA1);

    // O último proponente não sai.
    await expect(
      removeProcessParticipant(orgA.ctx, criado.id, pessoaA1, "proponente"),
    ).rejects.toThrow("pelo menos um proponente");

    // Volta como proponente e, por ter mais renda, retoma o principal.
    await addProcessParticipant(orgA.ctx, criado.id, pessoaA2, "proponente");
    expect((await getProcess(orgA.ctx, criado.id)).personId).toBe(pessoaA2);
  });
});
