import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { autoCaptureKey, readForAutoCapture } from "./auto-capture";
import { CAIXA_PROFILE, toCaixaValues } from "./caixa";
import { fillScreen } from "./engine";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function carregarFixture(nome: string): Document {
  const html = readFileSync(resolve(raiz, "fixtures/caixa", nome), "utf8");
  const window = new Window({ url: "https://caixaaqui.caixa.gov.br/caixaaqui/CaixaAquiController" });
  window.document.write(html);
  return window.document as unknown as Document;
}

function escrever(doc: Document, nome: string, valor: string) {
  doc.querySelector<HTMLInputElement>(`[name="${nome}"]`)!.value = valor;
}

describe("readForAutoCapture", () => {
  it("lê o CPF digitado na entrada do cadastro, com máscara", () => {
    const doc = carregarFixture("cadastro-de-clientes-1.html");
    escrever(doc, "cpf", "111.444.777-35");

    expect(readForAutoCapture(doc, CAIXA_PROFILE)).toEqual({
      screenKey: null,
      cpf: "11144477735",
      values: {},
      incomes: [],
    });
  });

  it("#cpf oculto (campo auxiliar de outras páginas) não conta como entrada", () => {
    const window = new Window({ url: "https://caixaaqui.caixa.gov.br/" });
    window.document.write('<form><input type="hidden" id="cpf" value="11144477735"></form>');
    expect(readForAutoCapture(window.document as unknown as Document, CAIXA_PROFILE)).toBeNull();
  });

  it("entrada com CPF incompleto não conta", () => {
    const doc = carregarFixture("cadastro-de-clientes-1.html");
    escrever(doc, "cpf", "111.444");
    expect(readForAutoCapture(doc, CAIXA_PROFILE)).toBeNull();
  });

  it("lê os dados cadastrais no formato do sistema, com o CPF à parte", () => {
    const doc = carregarFixture("cadastro-de-clientes-3.html");
    escrever(doc, "dataCpf", "11144477735");
    escrever(doc, "nomeCompleto", "ANA PAULA RIBEIRO");
    escrever(doc, "dataNascimento", "20/07/1991");
    escrever(doc, "pis", "12345678901");

    const captura = readForAutoCapture(doc, CAIXA_PROFILE)!;
    expect(captura.screenKey).toBe("cadastro_dados");
    expect(captura.cpf).toBe("11144477735");
    expect(captura.values).toMatchObject({
      "person.fullName": "ANA PAULA RIBEIRO",
      "person.birthDate": "1991-07-20",
      "person.pis": "12345678901",
    });
    expect(captura.values["person.cpf"]).toBeUndefined();
  });

  it("tela sem CPF volta sem CPF, para o background usar o da sessão", () => {
    const doc = carregarFixture("cadastro-de-clientes-4.html");
    escrever(doc, "cep", "01310100");

    const captura = readForAutoCapture(doc, CAIXA_PROFILE)!;
    expect(captura.screenKey).toBe("cadastro_endereco");
    expect(captura.cpf).toBeNull();
    expect(captura.values["person.zipCode"]).toBe("01310100");
  });

  it("página fora do perfil não gera captura", () => {
    expect(readForAutoCapture(carregarFixture("nav-1.html"), CAIXA_PROFILE)).toBeNull();
  });
});

describe("grupo familiar", () => {
  it("dependentes", () => {
    const doc = carregarFixture("cadastro-de-clientes-7.html");
    escrever(doc, "iNumSemDepRenda", "2");
    const captura = readForAutoCapture(doc, CAIXA_PROFILE)!;
    expect(captura.screenKey).toBe("dependentes");
    expect(captura.values).toEqual({ "person.dependentsCount": "2" });
  });

  it("despesas voltam em centavos", () => {
    const doc = carregarFixture("cadastro-de-clientes-8.html");
    escrever(doc, "iAluguel", "1.500,00");
    escrever(doc, "iCondominio", "350,50");
    const captura = readForAutoCapture(doc, CAIXA_PROFILE)!;
    expect(captura.screenKey).toBe("despesas");
    expect(captura.values).toEqual({
      "person.rentCents": "150000",
      "person.condoFeeCents": "35050",
    });
  });

  it("preencher despesas escreve no formato do portal", () => {
    const doc = carregarFixture("cadastro-de-clientes-8.html");
    const tela = CAIXA_PROFILE.screens.find((screen) => screen.key === "despesas")!;
    fillScreen(doc, tela, toCaixaValues({ rentCents: 150000, alimonyCents: 80000 }));
    expect(doc.querySelector<HTMLInputElement>("[name=\"iAluguel\"]")!.value).toBe("1500,00");
    expect(doc.querySelector<HTMLInputElement>("[name=\"iPenAli\"]")!.value).toBe("800,00");
  });
});

describe("rendas da lista do portal", () => {
  it("renda formal vem da lista, não do formulário vazio", () => {
    const captura = readForAutoCapture(carregarFixture("cadastro-de-clientes-5.html"), CAIXA_PROFILE)!;
    expect(captura.screenKey).toBe("renda_formal");
    expect(captura.incomes).toEqual([
      {
        kind: "formal",
        occupation: "PROPRIETARIO DE ESTABELECIMENTO DE PRESTACAO DE SE",
        startDate: "2018-01-01",
        grossCents: "5000,00",
        netCents: "4500,00",
        incomeTaxCents: "0,00",
        proofType: "contracheque",
        proofMonth: "6",
        proofYear: "2026",
      },
    ]);
    expect(Object.keys(captura.values).some((chave) => chave.startsWith("income."))).toBe(false);
  });

  it("renda informal", () => {
    const captura = readForAutoCapture(carregarFixture("cadastro-de-clientes-6.html"), CAIXA_PROFILE)!;
    expect(captura.screenKey).toBe("renda_informal");
    expect(captura.incomes).toEqual([
      { kind: "informal", sourceName: "CORRETOR", startDate: "2015-01-01", netCents: "1500,00" },
    ]);
  });
});

describe("autoCaptureKey", () => {
  it("não depende da ordem dos campos", () => {
    expect(autoCaptureKey("1", "t", { a: "1", b: "2" })).toBe(
      autoCaptureKey("1", "t", { b: "2", a: "1" }),
    );
    expect(autoCaptureKey("1", "t", { a: "1" })).not.toBe(autoCaptureKey("2", "t", { a: "1" }));
  });
});
