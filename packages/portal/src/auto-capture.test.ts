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

  it("listas voltam nos valores do sistema, não nos códigos do portal", () => {
    const doc = carregarFixture("cadastro-de-clientes-3.html");
    const escolher = (nome: string, valor: string) => {
      doc.querySelector<HTMLSelectElement>(`[name="${nome}"]`)!.value = valor;
    };
    escolher("cmbSexo", "F");
    escolher("cmbNacionalidade", "BRASILEIRO");
    escolher("cmbUFNaturalidade", "35");
    escolher("cmbMunicipioNaturalidade", "0010");
    escolher("cmbGrauInstrucao", "07");
    escolher("cmbEstadoCivil", "9");
    escolher("cmbTipoDocumento", "0372008");
    escolher("cmbOrgaoEmissorRg", "10");
    escolher("cmbUFIdentidadeRg", "SP");

    const captura = readForAutoCapture(doc, CAIXA_PROFILE)!;
    expect(captura.values).toMatchObject({
      "person.sex": "feminino",
      "person.nationality": "brasileiro",
      "person.birthUf": "SP",
      // Município e órgão emissor: o sistema guarda o nome que a tela mostra.
      "person.birthCity": "ADAMANTINA",
      "person.educationLevel": "medio_completo",
      "person.maritalStatus": "casado_comunhao_parcial",
      "person.docType": "rg",
      "person.docIssuer": "SECRETARIA DE SEGURANÇA PÚBLICA",
      "person.docIssuerUf": "SP",
    });
  });

  it("CNH: tipo, número, órgão pelo nome, UF e as três datas", () => {
    const doc = carregarFixture("cadastro-de-clientes-12-cnh.html");
    const valor = (nome: string, v: string) => {
      doc.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${nome}"]`)!.value = v;
    };
    valor("cmbTipoDocumento", "0782");
    valor("identidadeNumeroCnh", "01234567890");
    valor("cmbOrgaoEmissorCnh", "83");
    valor("cmbUFIdentidadeCnh", "SP");
    valor("dataPrimeiraHabilitacaoCnh", "10/04/2014");
    valor("dataEmissaoIdentidadeCnh", "10/04/2024");
    valor("dataFimValidadeCnh", "09/04/2034");

    expect(readForAutoCapture(doc, CAIXA_PROFILE)!.values).toMatchObject({
      "person.docType": "cnh",
      "person.docNumber": "01234567890",
      "person.docIssuer": "ÓRGÃO DE TRÂNSITO",
      "person.docIssuerUf": "SP",
      "person.docFirstLicenseDate": "2014-04-10",
      "person.docIssuedAt": "2024-04-10",
      "person.docValidUntil": "2034-04-09",
    });
  });

  it("RIC: o órgão vem da lista própria do RIC", () => {
    const doc = carregarFixture("cadastro-de-clientes-10-ric.html");
    doc.querySelector<HTMLSelectElement>("[name=\"cmbTipoDocumento\"]")!.value = "0372102";
    doc.querySelector<HTMLInputElement>("[name=\"identidadeNumeroRg\"]")!.value = "12345678901";
    doc.querySelector<HTMLSelectElement>("[name=\"cmbOrgaoEmissorRg\"]")!.value = "40";

    expect(readForAutoCapture(doc, CAIXA_PROFILE)!.values).toMatchObject({
      "person.docType": "ric",
      "person.docNumber": "12345678901",
      "person.docIssuer": "MINISTÉRIO DA JUSTIÇA",
    });
  });

  it("código que o sistema não conhece fica de fora", () => {
    const doc = carregarFixture("cadastro-de-clientes-3.html");
    const sexo = doc.querySelector<HTMLSelectElement>("[name=\"cmbSexo\"]")!;
    const opcao = doc.createElement("option");
    opcao.value = "X";
    opcao.textContent = "OUTRO";
    sexo.appendChild(opcao);
    sexo.value = "X";
    expect(readForAutoCapture(doc, CAIXA_PROFILE)!.values["person.sex"]).toBeUndefined();
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

describe("declaração de propósitos e agência", () => {
  it("marcações viram sim/não; o habitacional, a opção escolhida", () => {
    const doc = carregarFixture("cadastro-de-clientes-3.html");
    const marcar = (nome: string, valor: boolean) => {
      doc.querySelector<HTMLInputElement>(`[name="${nome}"]`)!.checked = valor;
    };
    marcar("movimentaContaDepositoPoupanca", true);
    marcar("emprestimosFinanciamentos", true);
    doc.querySelector<HTMLInputElement>("#habitacionalSIM")!.checked = true;
    marcar("cartaoCredito", false);

    expect(readForAutoCapture(doc, CAIXA_PROFILE)!.values).toMatchObject({
      "person.purposeAccounts": "true",
      "person.purposeLoans": "true",
      "person.purposeHousingLoan": "true",
      "person.purposeInvestments": "false",
      "person.purposeCreditCard": "false",
    });
  });

  it("habitacional sem resposta fica de fora (não é o mesmo que não)", () => {
    const doc = carregarFixture("cadastro-de-clientes-3.html");
    expect(readForAutoCapture(doc, CAIXA_PROFILE)!.values["person.purposeHousingLoan"]).toBeUndefined();
  });

  it("preencher marca as caixas e escolhe o habitacional", () => {
    const doc = carregarFixture("cadastro-de-clientes-3.html");
    const tela = CAIXA_PROFILE.screens.find((screen) => screen.key === "cadastro_dados")!;
    fillScreen(
      doc,
      tela,
      toCaixaValues({ purposeLoans: true, purposeHousingLoan: false, purposeInvestments: true }),
    );
    expect(doc.querySelector<HTMLInputElement>("#emprestimosFinanciamentos")!.checked).toBe(true);
    expect(doc.querySelector<HTMLInputElement>("#habitacionalNAO")!.checked).toBe(true);
    expect(doc.querySelector<HTMLInputElement>("#investimentos")!.checked).toBe(true);
    // "Não respondido" não mexe na marcação.
    expect(doc.querySelector<HTMLInputElement>("#cartaoCredito")!.checked).toBe(false);
  });

  it("agência de relacionamento vai para o cadastro da pessoa", () => {
    const doc = carregarFixture("cadastro-de-clientes-9.html");
    const escolher = (nome: string, valor: string) => {
      doc.querySelector<HTMLSelectElement>(`[name="${nome}"]`)!.value = valor;
    };
    escolher("cmbUFAgenciaRelacionamento", "SP");
    escolher("cmbMunicipioAgenciaRelacionamento", "000009030");
    escolher("cmbAgenciaRelacionamento", "2352");

    expect(readForAutoCapture(doc, CAIXA_PROFILE)!.values).toEqual({
      "person.relationshipAgencyUf": "SP",
      "person.relationshipAgencyCity": "ADAMANTINA",
      "person.relationshipAgencyNumber": "2352",
    });
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
