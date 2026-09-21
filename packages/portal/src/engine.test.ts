import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { CAIXA_PROFILE, toCaixaAgencyValues, toCaixaIncomeValues, toCaixaValues } from "./caixa";
import {
  bestScreenForFieldNames,
  captureScreen,
  discoverFields,
  expectedFieldNames,
  fillScreen,
  matchScreen,
  rankScreens,
} from "./engine";

/**
 * Os testes rodam contra as fixtures anonimizadas do portal real
 * (`fixtures/caixa/`), geradas por `scripts/anonimizar-fixtures.mjs`. É o que
 * permite mudar o motor de preenchimento sem abrir o Caixa Aqui — e descobrir
 * a quebra aqui, não com um cliente esperando do outro lado da mesa.
 */
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function carregarFixture(nome: string): Document {
  const html = readFileSync(resolve(raiz, "fixtures/caixa", nome), "utf8");
  const window = new Window({ url: "https://habitacao.caixa.gov.br/sicaq/cadastroCliente" });
  window.document.write(html);
  return window.document as unknown as Document;
}

const PESSOA = {
  cpf: "11144477735",
  fullName: "Ana Paula Ribeiro",
  shortName: "Ana P Ribeiro",
  birthDate: "1991-07-20",
  sex: "feminino",
  nationality: "brasileiro",
  birthUf: "SP",
  fatherName: "Carlos Ribeiro",
  motherName: "Marta Ribeiro",
  educationLevel: "superior_completo",
  pis: "12345678901",
  docType: "rg",
  docNumber: "478054188",
  docIssuedAt: "2018-09-03",
  maritalStatus: "casado_comunhao_parcial",
  spouseName: "Bruno Ribeiro",
  spouseCpf: "52998224725",
};

const TELA_DADOS = CAIXA_PROFILE.screens[0]!;

describe("reconhecimento de tela", () => {
  it("identifica a tela de dados cadastrais pela URL e pelo marcador", () => {
    const doc = carregarFixture("cadastro-de-clientes-3.html");
    const tela = matchScreen(
      CAIXA_PROFILE.screens,
      "https://habitacao.caixa.gov.br/sicaq/cadastroCliente",
      doc,
    );
    expect(tela?.key).toBe("cadastro_dados");
  });

  it("não confunde com a tela de endereço, que tem outros campos", () => {
    const doc = carregarFixture("cadastro-de-clientes-4.html");
    const tela = matchScreen(
      CAIXA_PROFILE.screens,
      "https://habitacao.caixa.gov.br/sicaq/cadastroCliente",
      doc,
    );
    expect(tela?.key).toBe("cadastro_endereco");
  });

  it("reconhece a tela mesmo quando a URL não é a esperada", () => {
    // Regressão: a primeira versão exigia um pedaço fixo na URL, escrito de
    // palpite porque as capturas são arquivos salvos, sem endereço de origem.
    // No portal de verdade o caminho era outro, e a extensão respondia "tela
    // ainda não mapeada" em todas as telas.
    const doc = carregarFixture("cadastro-de-clientes-3.html");
    const tela = matchScreen(
      CAIXA_PROFILE.screens,
      "https://qualquer-endereco-que-o-banco-use.gov.br/x/y/z.do?id=9",
      doc,
    );

    expect(tela?.key).toBe("cadastro_dados");
  });

  it("página sem nenhum campo do perfil não é reconhecida", () => {
    const window = new Window({ url: "https://habitacao.caixa.gov.br/qualquer" });
    window.document.write("<html><body><h1>Menu</h1><a href='#'>Entrar</a></body></html>");
    const vazia = window.document as unknown as Document;

    expect(matchScreen(CAIXA_PROFILE.screens, "https://habitacao.caixa.gov.br/cadastro", vazia)).toBeNull();
  });

  it("o ranking explica o que foi encontrado, para diagnóstico", () => {
    const doc = carregarFixture("cadastro-de-clientes-4.html");
    const ranking = rankScreens(CAIXA_PROFILE.screens, "https://x/y", doc);

    expect(ranking[0]?.screen.key).toBe("cadastro_endereco");
    expect(ranking[0]?.found).toBeGreaterThan(5);
    expect(ranking[0]?.total).toBeGreaterThan(ranking[0]!.found - 1);
  });
});

describe("preenchimento da tela de dados cadastrais", () => {
  let doc: Document;

  beforeEach(() => {
    doc = carregarFixture("cadastro-de-clientes-3.html");
  });

  it("escreve texto, data e documento nos campos certos", () => {
    fillScreen(doc, TELA_DADOS, toCaixaValues(PESSOA));

    const valor = (name: string) =>
      doc.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value;

    expect(valor("dataCpf")).toBe("11144477735");
    expect(valor("nomeCompleto")).toBe("ANA PAULA RIBEIRO");
    // O portal espera dd/mm/aaaa; o sistema guarda aaaa-mm-dd.
    expect(valor("dataNascimento")).toBe("20/07/1991");
    expect(valor("nomePai")).toBe("CARLOS RIBEIRO");
  });

  it("traduz valor de domínio para o código do portal", () => {
    fillScreen(doc, TELA_DADOS, toCaixaValues(PESSOA));

    const select = (name: string) =>
      doc.querySelector<HTMLSelectElement>(`[name="${name}"]`)?.value;

    expect(select("cmbSexo")).toBe("F");
    // "Casado com comunhão parcial" é o código 9 no SICAQ — casar por texto
    // visível quebraria a cada acento que o banco resolvesse trocar.
    expect(select("cmbEstadoCivil")).toBe("9");
    expect(select("cmbGrauInstrucao")).toBe("09");
    expect(select("cmbUFNaturalidade")).toBe("35");
  });

  it("preenche o grupo de documento do tipo selecionado", () => {
    fillScreen(doc, TELA_DADOS, toCaixaValues(PESSOA));

    expect(doc.querySelector<HTMLSelectElement>('[name="cmbTipoDocumento"]')?.value).toBe("0372008");
    expect(doc.querySelector<HTMLInputElement>('[name="identidadeNumeroRg"]')?.value).toBe(
      "478054188",
    );
    expect(doc.querySelector<HTMLInputElement>('[name="dataEmissaoIdentidadeRg"]')?.value).toBe(
      "03/09/2018",
    );
  });

  it("não escreve no grupo de outro tipo de documento", () => {
    const comCnh = { ...PESSOA, docType: "cnh", docFirstLicenseDate: "2010-01-15" };
    const doc12 = carregarFixture("cadastro-de-clientes-12-cnh.html");

    const resultados = fillScreen(doc12, TELA_DADOS, toCaixaValues(comCnh));

    expect(doc12.querySelector<HTMLInputElement>('[name="identidadeNumeroCnh"]')?.value).toBe(
      "478054188",
    );
    expect(doc12.querySelector<HTMLInputElement>('[name="dataPrimeiraHabilitacaoCnh"]')?.value).toBe(
      "15/01/2010",
    );

    // Os campos do RG nem existem nesta tela: o motor reporta em vez de
    // escrever às cegas.
    const doRg = resultados.filter((r) => r.selector.includes("Rg"));
    expect(doRg.every((r) => r.status !== "preenchido")).toBe(true);
  });

  it("campo sem valor no cadastro fica em branco, e isso é reportado", () => {
    const resultados = fillScreen(doc, TELA_DADOS, toCaixaValues({ ...PESSOA, pis: null }));

    const pis = resultados.find((r) => r.dataKey === "person.pis");
    expect(pis?.status).toBe("sem_valor");
    expect(doc.querySelector<HTMLInputElement>('[name="pis"]')?.value).toBe("");
  });

  it("valor sem opção equivalente não é chutado", () => {
    // União estável não existe no SICAQ: melhor deixar vazio para o operador
    // decidir do que marcar "casado" e falsear o regime de bens.
    const resultados = fillScreen(
      doc,
      TELA_DADOS,
      toCaixaValues({ ...PESSOA, maritalStatus: "uniao_estavel" }),
    );

    const estadoCivil = resultados.find((r) => r.dataKey === "person.maritalStatus");
    expect(estadoCivil?.status).toBe("sem_valor");
    expect(doc.querySelector<HTMLSelectElement>('[name="cmbEstadoCivil"]')?.value).toBe("");
  });

  it("dispara os eventos que a tela do banco escuta", () => {
    const campo = doc.querySelector<HTMLInputElement>('[name="nomeCompleto"]')!;
    const eventos: string[] = [];
    campo.addEventListener("input", () => eventos.push("input"));
    campo.addEventListener("change", () => eventos.push("change"));

    fillScreen(doc, TELA_DADOS, toCaixaValues(PESSOA));

    // Sem estes eventos, telas antigas salvam o campo vazio mesmo com o texto
    // aparecendo para quem está olhando.
    expect(eventos).toEqual(["input", "change"]);
  });

  it("não sobrescreve o que já está preenchido quando pedido", () => {
    const campo = doc.querySelector<HTMLInputElement>('[name="nomeCompleto"]')!;
    campo.value = "NOME JA DIGITADO";

    fillScreen(doc, TELA_DADOS, toCaixaValues(PESSOA), { skipFilled: true });

    expect(campo.value).toBe("NOME JA DIGITADO");
  });

  it("nunca submete o formulário", () => {
    let submetido = false;
    doc.querySelector("form")?.addEventListener("submit", () => {
      submetido = true;
    });

    fillScreen(doc, TELA_DADOS, toCaixaValues(PESSOA));

    // Quem confere e salva é o operador. Esta é a linha entre assistir e agir
    // sozinho dentro do sistema do banco.
    expect(submetido).toBe(false);
  });
});

describe("captura da tela", () => {
  it("lê o que está na tela e devolve no formato do sistema", () => {
    const doc = carregarFixture("cadastro-de-clientes-3.html");
    fillScreen(doc, TELA_DADOS, toCaixaValues(PESSOA));

    const capturado = Object.fromEntries(
      captureScreen(doc, TELA_DADOS).map((item) => [item.dataKey, item.value]),
    );

    expect(capturado["person.fullName"]).toBe("ANA PAULA RIBEIRO");
    // A data volta convertida para o formato do sistema.
    expect(capturado["person.birthDate"]).toBe("1991-07-20");
  });

  it("ignora campo vazio em vez de gravar string vazia", () => {
    const doc = carregarFixture("cadastro-de-clientes-3.html");
    const capturado = captureScreen(doc, TELA_DADOS);
    expect(capturado).toEqual([]);
  });
});

describe("modo de aprendizado", () => {
  it("lista os campos da tela e marca os que o perfil já conhece", () => {
    const doc = carregarFixture("cadastro-de-clientes-3.html");
    const campos = discoverFields(doc, TELA_DADOS);

    expect(campos.length).toBeGreaterThan(20);

    const nome = campos.find((c) => c.name === "nomeCompleto");
    expect(nome?.known).toBe(true);

    // Campo que o perfil ainda não mapeia aparece como desconhecido, que é o
    // que a extensão oferece para o operador ensinar.
    const desconhecidos = campos.filter((c) => !c.known);
    expect(desconhecidos.length).toBeGreaterThan(0);
  });

  it("tenta adivinhar o rótulo a partir da tabela, já que não há label", () => {
    const doc = carregarFixture("cadastro-de-clientes-3.html");
    const campos = discoverFields(doc, null);

    const comRotulo = campos.filter((c) => c.label && c.label !== c.name);
    expect(comRotulo.length).toBeGreaterThan(5);
  });
});

/**
 * A extensão sonda cada frame da aba e recebe de volta só a lista de nomes de
 * campo. É com essa lista que ela decide onde trabalhar — no SICAQ o
 * documento de cima pode ter só o menu, com a tela real dentro de um frame.
 */
describe("escolha do frame pela lista de campos", () => {
  function nomesDaFixture(nome: string): string[] {
    const doc = carregarFixture(nome);
    return [...doc.querySelectorAll("input[name], select[name], textarea[name]")]
      .map((elemento) => elemento.getAttribute("name"))
      .filter((n): n is string => Boolean(n));
  }

  it("reconhece a tela a partir só dos nomes dos campos", () => {
    const resultado = bestScreenForFieldNames(
      CAIXA_PROFILE.screens,
      nomesDaFixture("cadastro-de-clientes-3.html"),
    );

    expect(resultado?.screen.key).toBe("cadastro_dados");
    expect(resultado?.markerFound).toBe(true);
  });

  it("distingue a tela de endereço da de dados", () => {
    const resultado = bestScreenForFieldNames(
      CAIXA_PROFILE.screens,
      nomesDaFixture("cadastro-de-clientes-4.html"),
    );

    expect(resultado?.screen.key).toBe("cadastro_endereco");
  });

  it("frame de menu, sem campos, não é escolhido", () => {
    // É exatamente o caso que fazia a extensão responder "não mapeada": o
    // frame de cima respondia primeiro, e ele não tem campo nenhum.
    expect(bestScreenForFieldNames(CAIXA_PROFILE.screens, [])).toBeNull();
    expect(bestScreenForFieldNames(CAIXA_PROFILE.screens, ["busca", "menu"])).toBeNull();
  });

  it("os campos esperados saem dos seletores do perfil", () => {
    const nomes = expectedFieldNames(CAIXA_PROFILE.screens[0]!);
    expect(nomes).toContain("nomeCompleto");
    expect(nomes).toContain("cmbEstadoCivil");
    expect(nomes.every((nome) => !nome.includes("["))).toBe(true);
  });
});

/**
 * Telas de renda e agência. Foram adicionadas depois de o uso real revelar
 * que a extensão dizia "tela não mapeada" justamente na tela de renda — que
 * de fato não estava no perfil.
 */
describe("tela de renda formal", () => {
  const TELA = CAIXA_PROFILE.screens.find((tela) => tela.key === "renda_formal")!;

  const RENDA = {
    kind: "formal",
    sourceName: "Empresa Exemplo Ltda",
    sourceDocument: "11222333000181",
    occupation: "ADVOGADO",
    startDate: "2019-03-11",
    grossCents: 750000,
    netCents: 610000,
    proofType: "contracheque",
    proofMonth: 8,
    proofYear: 2026,
    previousJobYears: 2,
    previousJobMonths: 4,
  };

  it("é reconhecida pela própria tela, sem depender da URL", () => {
    const doc = carregarFixture("cadastro-de-clientes-5.html");
    const tela = matchScreen(CAIXA_PROFILE.screens, "https://caixaaqui.caixa.gov.br/x", doc);
    expect(tela?.key).toBe("renda_formal");
  });

  it("preenche fonte pagadora, valores e comprovante", () => {
    const doc = carregarFixture("cadastro-de-clientes-5.html");
    fillScreen(doc, TELA, toCaixaIncomeValues(RENDA));

    const valor = (name: string) =>
      doc.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)?.value;

    expect(valor("fontePagadora")).toBe("EMPRESA EXEMPLO LTDA");
    expect(valor("valorRendaBruta")).toBe("7500,00");
    expect(valor("valorRendaLiquida")).toBe("6100,00");
    expect(valor("dataAdmissao")).toBe("11/03/2019");
    // Competência vai num campo só, como MM/AAAA.
    expect(valor("dtRefCompr")).toBe("08/2026");
    // "Contracheque" é o código 64522009 no SICAQ.
    expect(valor("cmbComprovanteRenda")).toBe("64522009");
  });

  it("deduz se a fonte é física ou jurídica pelo documento", () => {
    const doc = carregarFixture("cadastro-de-clientes-5.html");
    fillScreen(doc, TELA, toCaixaIncomeValues(RENDA));

    // 14 dígitos = CNPJ = JURÍDICA (código 2), e aí o número vai no campo de
    // CNPJ, não no de CPF.
    expect(doc.querySelector<HTMLSelectElement>('[name="cmbCnpj_cpf"]')?.value).toBe("2");
    expect(doc.querySelector<HTMLInputElement>('[name="numeroCnpj"]')?.value).toBe(
      "11222333000181",
    );
    expect(doc.querySelector<HTMLInputElement>('[name="numeroCpf"]')?.value).toBe("");
  });

  it("fonte pessoa física cai no campo de CPF", () => {
    const doc = carregarFixture("cadastro-de-clientes-5.html");
    fillScreen(doc, TELA, toCaixaIncomeValues({ ...RENDA, sourceDocument: "11144477735" }));

    expect(doc.querySelector<HTMLSelectElement>('[name="cmbCnpj_cpf"]')?.value).toBe("1");
    expect(doc.querySelector<HTMLInputElement>('[name="numeroCpf"]')?.value).toBe("11144477735");
    expect(doc.querySelector<HTMLInputElement>('[name="numeroCnpj"]')?.value).toBe("");
  });

  it("a tela é marcada como dependente de uma renda escolhida", () => {
    // Sem isso, o painel preencheria a primeira fonte da lista sem avisar.
    expect(TELA.needsIncome).toBe(true);
  });
});

describe("tela de renda informal", () => {
  it("é reconhecida e preenche atividade e valor", () => {
    const doc = carregarFixture("cadastro-de-clientes-6.html");
    const tela = matchScreen(CAIXA_PROFILE.screens, "https://caixaaqui.caixa.gov.br/x", doc);
    expect(tela?.key).toBe("renda_informal");

    fillScreen(doc, tela!, toCaixaIncomeValues({
      kind: "informal",
      sourceName: "Acougueiro",
      startDate: "2021-05-02",
      netCents: 320000,
    }));

    expect(doc.querySelector<HTMLInputElement>('[name="rendaLiquidaMensal"]')?.value).toBe("3200,00");
    expect(doc.querySelector<HTMLInputElement>('[name="dataDeInicio"]')?.value).toBe("02/05/2021");
  });
});

describe("tela de agência de relacionamento", () => {
  it("é reconhecida e preenche a agência do processo", () => {
    const doc = carregarFixture("cadastro-de-clientes-9.html");
    const tela = matchScreen(CAIXA_PROFILE.screens, "https://caixaaqui.caixa.gov.br/x", doc);
    expect(tela?.key).toBe("agencia_relacionamento");

    fillScreen(doc, tela!, toCaixaAgencyValues({ number: "2352", city: null, uf: "SP" }));

    expect(doc.querySelector<HTMLSelectElement>('[name="cmbUFAgenciaRelacionamento"]')?.value).toBe("SP");
    expect(doc.querySelector<HTMLSelectElement>('[name="cmbAgenciaRelacionamento"]')?.value).toBe("2352");
  });
});
