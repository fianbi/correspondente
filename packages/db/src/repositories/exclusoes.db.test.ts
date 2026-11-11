import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { simulationInputSchema } from "@corr/core";
import { CPFS_VALIDOS, createTestOrg, destroyTestOrg, type TestOrg } from "../testing/fixtures";
import { createPerson, deletePerson, getPerson } from "./people";
import { createProcess, getProcess } from "./processes";
import { registerDocument } from "./documents";
import { createSimulation, deleteSimulation, getSimulation } from "./simulations";

let orgA: TestOrg;
let orgB: TestOrg;

beforeAll(async () => {
  orgA = await createTestOrg("excl-a");
  orgB = await createTestOrg("excl-b");
});

afterAll(async () => {
  await destroyTestOrg(orgA);
  await destroyTestOrg(orgB);
});

const novaPessoa = (org: TestOrg, cpf: string, nome: string) =>
  createPerson(org.ctx, { cpf, fullName: nome } as Parameters<typeof createPerson>[1]);

describe("excluir pessoa", () => {
  it("pede o primeiro nome e leva rendas e documentos do cadastro", async () => {
    const pessoa = await novaPessoa(orgA, CPFS_VALIDOS[0], "JOSÉ DA SILVA");
    await registerDocument(orgA.ctx, {
      personId: pessoa.id,
      processId: null,
      type: "rg" as never,
      title: "RG",
      storagePath: `${orgA.orgId}/pessoas/${pessoa.id}/rg.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 10,
      stageKey: null,
      source: "interno",
    } as Parameters<typeof registerDocument>[1]);

    await expect(deletePerson(orgA.ctx, pessoa.id, "maria")).rejects.toThrow(/primeiro nome/);
    await expect(deletePerson(orgB.ctx, pessoa.id, "jose")).rejects.toThrow();

    const { removedFiles } = await deletePerson(orgA.ctx, pessoa.id, "  José ");
    expect(removedFiles).toEqual([`${orgA.orgId}/pessoas/${pessoa.id}/rg.pdf`]);
    await expect(getPerson(orgA.ctx, pessoa.id)).rejects.toThrow();
  });

  it("não exclui quem está em processo", async () => {
    const pessoa = await novaPessoa(orgA, CPFS_VALIDOS[1], "ANA PROPONENTE");
    const processo = await createProcess(orgA.ctx, { personId: pessoa.id } as Parameters<
      typeof createProcess
    >[1]);

    await expect(deletePerson(orgA.ctx, pessoa.id, "ana")).rejects.toThrow(/1 processo/);
    expect((await getProcess(orgA.ctx, processo.id)).personId).toBe(pessoa.id);
  });
});

describe("excluir simulação", () => {
  it("só o escritório dono exclui", async () => {
    const sim = await createSimulation(
      orgA.ctx,
      simulationInputSchema.parse({ clientName: "Cliente Teste", clientPhone: "(11) 99999-0000", scenarios: [] }),
    );
    await expect(deleteSimulation(orgB.ctx, sim.id)).rejects.toThrow();
    await deleteSimulation(orgA.ctx, sim.id);
    await expect(getSimulation(orgA.ctx, sim.id)).rejects.toThrow();
  });
});
