import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { simulationInputSchema } from "@corr/core";
import { CPFS_VALIDOS, createTestOrg, destroyTestOrg, type TestOrg } from "../testing/fixtures";
import { createProcessWithParticipants } from "./participants";
import { getProcess } from "./processes";
import {
  createSimulation,
  getProcessSimulation,
  getSimulation,
  listSimulations,
} from "./simulations";

let orgA: TestOrg;
let orgB: TestOrg;

beforeAll(async () => {
  orgA = await createTestOrg("sim-a");
  orgB = await createTestOrg("sim-b");
});

afterAll(async () => {
  await destroyTestOrg(orgA);
  await destroyTestOrg(orgB);
});

const simulacao = () =>
  simulationInputSchema.parse({
    clientName: "Cliente Só Simulou",
    clientPhone: "(11) 99999-0000",
    familyIncomeCents: "6.500,00",
    propertyValueCents: "300000",
    multipleBuyers: "sim",
    hadSubsidy: "nao",
    scenarios: [
      { financedValueCents: "240000", termMonths: "420", amortization: "sac", chosen: false },
      { financedValueCents: "250000", termMonths: "360", amortization: "price", chosen: true },
    ],
  });

describe("simulações", () => {
  it("guarda o cliente sem CPF e só aparece para o próprio escritório", async () => {
    const { id } = await createSimulation(orgA.ctx, simulacao());
    const salva = await getSimulation(orgA.ctx, id);

    expect(salva.familyIncomeCents).toBe(650000);
    expect(salva.multipleBuyers).toBe(true);
    expect(salva.hadSubsidy).toBe(false);
    expect(salva.ownsProperty).toBeNull();
    expect((await listSimulations(orgB.ctx)).map((s) => s.id)).not.toContain(id);
  });

  it("abrir processo cria a pessoa e leva o cenário escolhido", async () => {
    const { id } = await createSimulation(orgA.ctx, simulacao());

    const processo = await createProcessWithParticipants(orgA.ctx, {
      modality: "aquisicao_imovel_usado",
      proponentIds: [],
      participants: [],
      brokerId: null,
      newBrokerName: null,
      realEstateAgencyId: null,
      newRealEstateAgencyName: null,
      simulationId: id,
      newPerson: { cpf: CPFS_VALIDOS[2], fullName: "Cliente Só Simulou" },
    });

    const completo = await getProcess(orgA.ctx, processo.id);
    expect(completo.participants).toEqual([
      expect.objectContaining({ cpf: CPFS_VALIDOS[2], fullName: "CLIENTE SÓ SIMULOU", role: "proponente" }),
    ]);
    expect(completo.propertyValueCents).toBe(30000000);
    expect(completo.financedValueCents).toBe(25000000);
    expect(completo.termMonths).toBe(360);
    expect(completo.amortizationSystem).toBe("price");
    expect((await getProcessSimulation(orgA.ctx, processo.id))?.id).toBe(id);
  });
});
