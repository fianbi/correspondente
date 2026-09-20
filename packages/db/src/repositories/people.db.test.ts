import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { personInputSchema } from "@corr/core";
import { createTestOrg, destroyTestOrg, CPFS_VALIDOS, type TestOrg } from "../testing/fixtures";
import { DuplicatePersonError, createPerson, findPersonByCpf, getPerson, listPeople, updatePerson } from "./people";

/** Monta o input já validado, como chega de um formulário do web. */
function personInput(fields: { cpf: string; fullName: string } & Record<string, unknown>) {
  return personInputSchema.parse({
    shortName: "",
    birthDate: "",
    sex: "",
    nationality: "",
    birthUf: "",
    birthCity: "",
    motherName: "",
    fatherName: "",
    educationLevel: "",
    pis: "",
    docType: "",
    docNumber: "",
    docIssuer: "",
    docIssuerUf: "",
    docIssuedAt: "",
    docValidUntil: "",
    maritalStatus: "",
    spouseCpf: "",
    spouseName: "",
    email: "",
    phone: "",
    zipCode: "",
    streetType: "",
    street: "",
    streetNumber: "",
    complement: "",
    district: "",
    city: "",
    uf: "",
    propertyType: "",
    housingSituation: "",
    residenceProofMonth: "",
    residenceProofYear: "",
    notes: "",
    ...fields,
  });
}

let orgA: TestOrg;
let orgB: TestOrg;

beforeAll(async () => {
  orgA = await createTestOrg("pessoas-a");
  orgB = await createTestOrg("pessoas-b");
});

afterAll(async () => {
  await destroyTestOrg(orgA);
  await destroyTestOrg(orgB);
});

describe("cadastro de pessoas", () => {
  it("normaliza o CPF na gravação, independente da máscara digitada", async () => {
    const person = await createPerson(
      orgA.ctx,
      personInput({ cpf: "111.444.777-35", fullName: "Ana Paula Ribeiro" }),
    );

    expect(person.cpf).toBe("11144477735");

    const found = await findPersonByCpf(orgA.ctx, "111 444 777 35");
    expect(found?.id).toBe(person.id);
  });

  it("recusa CPF repetido no mesmo escritório e devolve quem já existe", async () => {
    const error = await createPerson(
      orgA.ctx,
      personInput({ cpf: CPFS_VALIDOS[0], fullName: "Outro Nome Qualquer" }),
    ).then(
      () => null,
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(DuplicatePersonError);
    // O id do cadastro existente é o que permite oferecer "abrir cadastro" em
    // vez de só dizer "CPF duplicado" e deixar o operador procurar na mão.
    expect((error as DuplicatePersonError).personId).toBeTruthy();
    expect((error as DuplicatePersonError).fullName).toBe("Ana Paula Ribeiro");
  });

  it("o mesmo CPF pode existir em escritórios diferentes", async () => {
    const noOutroEscritorio = await createPerson(
      orgB.ctx,
      personInput({ cpf: CPFS_VALIDOS[0], fullName: "Ana Paula Ribeiro" }),
    );

    expect(noOutroEscritorio.orgId).toBe(orgB.orgId);
  });

  it("não deixa a atualização roubar o CPF de outro cadastro", async () => {
    const segunda = await createPerson(
      orgA.ctx,
      personInput({ cpf: CPFS_VALIDOS[1], fullName: "Bruno Martins de Souza" }),
    );

    await expect(
      updatePerson(orgA.ctx, segunda.id, personInput({ cpf: CPFS_VALIDOS[0], fullName: "Bruno Martins de Souza" })),
    ).rejects.toBeInstanceOf(DuplicatePersonError);
  });

  it("busca por nome e por dígitos do CPF na mesma caixa", async () => {
    const porNome = await listPeople(orgA.ctx, { search: "bruno" });
    expect(porNome.rows.map((r) => r.fullName)).toContain("Bruno Martins de Souza");

    const porCpf = await listPeople(orgA.ctx, { search: "529982" });
    expect(porCpf.rows.map((r) => r.cpf)).toContain(CPFS_VALIDOS[1]);
  });

  it("a listagem de um escritório não enxerga pessoas do outro", async () => {
    const deA = await listPeople(orgA.ctx, {});
    const deB = await listPeople(orgB.ctx, {});

    expect(deA.rows.length).toBe(2);
    expect(deB.rows.length).toBe(1);
  });

  it("abrir pela URL uma pessoa de outro escritório dá 'não encontrado'", async () => {
    const [pessoaDeB] = (await listPeople(orgB.ctx, {})).rows;
    expect(pessoaDeB).toBeDefined();

    await expect(getPerson(orgA.ctx, pessoaDeB!.id)).rejects.toThrow(/não encontrad/i);
  });
});
