import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

vi.mock("server-only", () => ({}));

const { resolverValor } = await import("./formulario");
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

describe("modelo pronto Caixa MO43047011", async () => {
  const { desenharModeloPronto, planejarModeloPronto } = await import("./formulario");
  const { perguntasDoModeloPronto } = await import("./modelos");
  const { StandardFonts } = await import("pdf-lib");
  const modelo = getModeloPronto("caixa-mo43047011")!;
  const fonte = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);

  const comProcesso = {
    ...dados,
    fieldValues: {
      "process.checking_agency": "1234",
      "process.checking_operation": "001",
      "process.checking_account_number": "000123456789",
      "process.checking_dv": "6",
      "process.builder": "Construtora Exemplo de Nome Bem Comprido Engenharia Ltda",
    },
  };
  const respostas = { "m:Cartão de Crédito": "1", "o:Programa habitacional": "SBPE" };
  const plano = planejarModeloPronto(modelo, comProcesso, respostas, fonte);
  const textos = plano.map((escrita) => escrita.texto);

  it("escreve o cadastro e a conta corrente inteira, sem cortar", () => {
    expect(textos).toContain("Maria Souza");
    expect(textos).toContain("529.982.247-25");
    expect(textos).toContain("Correspondente Exemplo Ltda");
    expect(textos).toContain("000123456789");
    expect(textos).toContain("novembro");
  });

  it("quebra linha quando o texto não cabe, em vez de diminuir a letra", () => {
    const construtora = plano.filter((escrita) => escrita.x === 121);
    expect(construtora.length).toBeGreaterThan(1);
    expect(construtora[1]!.base).toBeGreaterThan(construtora[0]!.base);
  });

  it("marca X só no que foi escolhido", () => {
    const marcas = plano.filter((escrita) => escrita.texto === "X").map((escrita) => Math.round(escrita.x));
    // Dossiê, conta corrente, cartão, SBPE, renda formal e declaração.
    expect(marcas).toHaveLength(6);
  });

  it("pergunta cartão, cheque, consignado, programa e comprovante", () => {
    expect(perguntasDoModeloPronto(modelo)).toEqual([
      { tipo: "marcar", campo: "Cheque Especial" },
      { tipo: "marcar", campo: "Cartão de Crédito" },
      { tipo: "marcar", campo: "Crédito Consignado" },
      {
        tipo: "opcao",
        grupo: "Programa habitacional",
        opcoes: ["MCMV", "SBPE", "PRO-COTISTA", "EGI"],
        obrigatoria: true,
      },
      {
        tipo: "opcao",
        grupo: "Comprovante de endereço",
        opcoes: ["Titular", "Em nome de terceiros"],
        obrigatoria: false,
      },
    ]);
  });

  it("gera um PDF de uma página", async () => {
    const pdf = await desenharModeloPronto(modelo, comProcesso, respostas);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  });

  it("só existe uma vez na lista", () => {
    expect(MODELOS_PRONTOS.filter((m) => m.chave === modelo.chave)).toHaveLength(1);
  });
});
