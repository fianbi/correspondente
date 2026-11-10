import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

vi.mock("server-only", () => ({}));

const { detectarCampos, preencherFormulario, resolverValor } = await import("./formulario");
const { MODELOS_PRONTOS, getModeloPronto } = await import("./modelos");

const dados = {
  person: { fullName: "Maria Souza", cpf: "52998224725", spouseName: "José Souza", spouseCpf: "11144477735" },
  process: { contractNumber: "8.4444.0001234-5", participants: [] },
  org: { name: "Correspondente Exemplo Ltda", internalCode: "12345", city: "Curitiba" },
  fieldValues: { "assembly.checking_account": "sim", "assembly.credit_card": "nao" },
  incomes: [{ kind: "formal" }],
  hoje: new Date("2026-11-10T15:00:00Z"),
};

describe("resolverValor", () => {
  it("lê campo de processo guardado em coluna pela chave do catálogo", () => {
    expect(resolverValor("process.contract_number", dados)).toBe("8.4444.0001234-5");
  });

  it("usa o cônjuge como coobrigado quando não há 2º proponente", () => {
    expect(resolverValor("coobrigado.fullName", dados)).toBe("José Souza");
    expect(resolverValor("coobrigado.cpf", dados)).toBe("111.444.777-35");
  });

  it("prefere o 2º proponente ao cônjuge", () => {
    const comCo = {
      ...dados,
      process: {
        ...dados.process,
        participants: [{ fullName: "Ana Lima", cpf: "52998224725", role: "coproponente" }],
      },
    };
    expect(resolverValor("coobrigado.fullName", comCo)).toBe("Ana Lima");
  });

  it("escreve a data de hoje no fuso de Brasília, com o mês por extenso", () => {
    expect(resolverValor("hoje.dia", dados)).toBe("10");
    expect(resolverValor("hoje.mes", dados)).toBe("novembro");
    expect(resolverValor("hoje.ano", dados)).toBe("2026");
    // 01h UTC do dia 11 ainda é dia 10 em Brasília.
    expect(resolverValor("hoje.dia", { ...dados, hoje: new Date("2026-11-11T01:00:00Z") })).toBe("10");
  });

  it("marca X conforme o cadastro", () => {
    expect(resolverValor("marcar.renda_formal", dados)).toBe("X");
    expect(resolverValor("marcar.renda_informal", dados)).toBe("");
    expect(resolverValor("marcar.conta_corrente", dados)).toBe("X");
    expect(resolverValor("marcar.cartao_credito", dados)).toBe("");
  });
});

describe("modelo pronto Caixa MO43047011", () => {
  const modelo = getModeloPronto("caixa-mo43047011")!;

  it("tem todos os campos mapeados presentes no PDF", async () => {
    const campos = await detectarCampos(modelo.pdf().slice().buffer);
    expect(campos.length).toBeGreaterThan(30);
    for (const campo of Object.keys(modelo.fieldMap)) expect(campos).toContain(campo);
  });

  it("sai preenchido com o cadastro", async () => {
    const { pdf, preenchidos } = await preencherFormulario(
      modelo.pdf().slice().buffer,
      modelo.fieldMap,
      dados,
    );
    const form = (await PDFDocument.load(pdf)).getForm();
    expect(form.getTextField("Proponente").getText()).toBe("Maria Souza");
    expect(form.getTextField("CPF do proponente").getText()).toBe("529.982.247-25");
    expect(form.getTextField("Razão Social - CCA").getText()).toBe("Correspondente Exemplo Ltda");
    expect(form.getTextField("Renda Formal").getText()).toBe("X");
    expect(form.getTextField("Mês").getText()).toBe("novembro");
    expect(preenchidos).toContain("Nº do Contrato");
  });

  it("só existe uma vez na lista", () => {
    expect(MODELOS_PRONTOS.filter((m) => m.chave === modelo.chave)).toHaveLength(1);
  });
});
