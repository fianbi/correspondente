import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { personInputSchema, processInputSchema } from "@corr/core";
import { createTestOrg, destroyTestOrg, CPFS_VALIDOS, type TestOrg } from "../testing/fixtures";
import { createPerson } from "./people";
import { createProcess, listProcesses } from "./processes";
import {
  createAgency,
  deleteAgency,
  findOrCreateAgency,
  listAgencies,
  listBanks,
  updateAgency,
} from "./catalogs";

let orgA: TestOrg;
let orgB: TestOrg;
let caixa: string;

beforeAll(async () => {
  orgA = await createTestOrg("ag-a");
  orgB = await createTestOrg("ag-b");
  const bank = (await listBanks()).find((b) => b.code === "104");
  if (!bank) throw new Error("Banco 104 não está no seed.");
  caixa = bank.id;
});

afterAll(async () => {
  await destroyTestOrg(orgA);
  await destroyTestOrg(orgB);
});

describe("cadastro de agências", () => {
  it("cadastra, altera e não deixa repetir o número no mesmo banco", async () => {
    const agencia = await createAgency(orgA.ctx, { bankId: caixa, number: "1234", name: "Centro" });
    await expect(
      createAgency(orgA.ctx, { bankId: caixa, number: "1234", name: "Outra" }),
    ).rejects.toThrow("Já existe uma agência com esse número");

    await updateAgency(orgA.ctx, agencia.id, {
      bankId: caixa,
      number: "1234",
      name: "Centro Florianópolis",
      city: "Florianópolis",
      uf: "SC",
    });
    const lista = await listAgencies(orgA.ctx);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ name: "Centro Florianópolis", city: "Florianópolis", processCount: 0 });

    // O número é por escritório: outro escritório pode ter a mesma agência.
    await createAgency(orgB.ctx, { bankId: caixa, number: "1234", name: "Centro" });
    expect(await listAgencies(orgB.ctx)).toHaveLength(1);
  });

  it("agência digitada no processo reaproveita a cadastrada ou cria com nome e cidade", async () => {
    const existente = (await listAgencies(orgA.ctx)).find((a) => a.number === "1234");
    expect(await findOrCreateAgency(orgA.ctx, { bankId: caixa, number: "1234", name: "X" })).toBe(
      existente?.id,
    );

    const nova = await findOrCreateAgency(orgA.ctx, {
      bankId: caixa,
      number: "0567",
      name: "Trindade",
      city: "Florianópolis",
    });
    const semNome = await findOrCreateAgency(orgA.ctx, { bankId: caixa, number: "0890", name: "  " });
    const lista = await listAgencies(orgA.ctx);
    expect(lista.find((a) => a.id === nova)).toMatchObject({ name: "Trindade", city: "Florianópolis" });
    expect(lista.find((a) => a.id === semNome)).toMatchObject({ name: "Agência 0890", city: null });
  });

  it("conta processos, filtra por agência e não exclui agência em uso", async () => {
    const pessoa = await createPerson(
      orgA.ctx,
      personInputSchema.parse({ cpf: CPFS_VALIDOS[0], fullName: "Cliente da Agência" }),
    );
    const agencia = (await listAgencies(orgA.ctx)).find((a) => a.number === "1234");
    if (!agencia) throw new Error("agência 1234 sumiu");
    await createProcess(
      orgA.ctx,
      processInputSchema.parse({ personId: pessoa.id, bankId: caixa, agencyId: agencia.id }),
    );
    await createProcess(orgA.ctx, processInputSchema.parse({ personId: pessoa.id }));

    expect((await listAgencies(orgA.ctx)).find((a) => a.id === agencia.id)?.processCount).toBe(1);
    const filtrados = await listProcesses(orgA.ctx, { agencyId: agencia.id });
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0]?.agencyNumber).toBe("1234");

    await expect(deleteAgency(orgA.ctx, agencia.id)).rejects.toThrow("Um processo usa esta agência");

    const livre = (await listAgencies(orgA.ctx)).find((a) => a.number === "0890");
    if (!livre) throw new Error("agência 0890 sumiu");
    await deleteAgency(orgA.ctx, livre.id);
    expect((await listAgencies(orgA.ctx)).some((a) => a.id === livre.id)).toBe(false);
  });

  it("não mexe na agência de outro escritório", async () => {
    const deB = (await listAgencies(orgB.ctx))[0];
    if (!deB) throw new Error("escritório B sem agência");
    await expect(
      updateAgency(orgA.ctx, deB.id, { bankId: caixa, number: "9999", name: "Invasão" }),
    ).rejects.toThrow();
    await expect(deleteAgency(orgA.ctx, deB.id)).rejects.toThrow();
    expect((await listAgencies(orgB.ctx))[0]?.name).toBe("Centro");
  });
});
