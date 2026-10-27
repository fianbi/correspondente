import { portais } from "@corr/core";

/**
 * Rendas que o portal já tem cadastradas para a pessoa.
 *
 * Nas telas de renda, o formulário serve só para adicionar uma fonte nova e
 * fica vazio quando já existem rendas: os dados de verdade estão na "Lista de
 * Rendas", uma tabela de linhas rótulo/valor (`td.textoAzul` + a célula
 * seguinte). Ler só o formulário perderia justamente o que o operador acabou
 * de cadastrar no banco.
 */

/** Uma renda no formato de entrada do cadastro (`personIncomeInputSchema`). */
export interface SavedIncome {
  kind: "formal" | "informal";
  sourceDocument?: string;
  sourceName?: string;
  occupation?: string;
  startDate?: string;
  /** Valores como o portal mostra ("5000,00"); o servidor converte. */
  grossCents?: string;
  netCents?: string;
  incomeTaxCents?: string;
  proofType?: string;
  proofMonth?: string;
  proofYear?: string;
}

type Entrada = Record<string, string>;

/**
 * Junta as linhas da tabela em entradas. Uma linha sem par rótulo/valor (a de
 * "Alterar/Excluir") fecha a entrada atual.
 */
function lerEntradas(tabela: Element): Entrada[] {
  const entradas: Entrada[] = [];
  let atual: Entrada = {};

  for (const linha of Array.from(tabela.querySelectorAll("tr"))) {
    const celulas = Array.from(linha.querySelectorAll("td"));
    let pares = 0;

    celulas.forEach((celula, indice) => {
      const valor = celulas[indice + 1];
      if (!celula.classList.contains("textoAzul") || !valor) return;
      atual[texto(celula)] = texto(valor);
      pares += 1;
    });

    if (pares === 0 && Object.keys(atual).length > 0) {
      entradas.push(atual);
      atual = {};
    }
  }

  if (Object.keys(atual).length > 0) entradas.push(atual);
  return entradas;
}

function texto(elemento: Element): string {
  return (elemento.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** `01/01/2018` vira `2018-01-01`; o resto é descartado. */
function dataIso(valor: string | undefined): string | undefined {
  const match = valor?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

function preenchido(valor: string | undefined): string | undefined {
  return valor && valor.trim() !== "" ? valor.trim() : undefined;
}

/**
 * O comprovante aparece pelo rótulo ("CONTRACHEQUE/HOLLERITH"). O código vem
 * do próprio `<select>` da tela, e do código se volta ao valor do sistema.
 */
function comprovante(root: Document, rotulo: string | undefined): string | undefined {
  if (!rotulo) return undefined;
  const select = root.querySelector<HTMLSelectElement>('[name="cmbComprovanteRenda"]');
  const opcao = Array.from(select?.options ?? []).find((item) => texto(item) === rotulo);
  if (!opcao) return undefined;

  const encontrado = Object.entries(portais.CAIXA_INCOME_PROOF).find(
    ([, codigo]) => codigo === opcao.value,
  );
  return encontrado?.[0];
}

function rendaFormal(root: Document, entrada: Entrada): SavedIncome {
  // A competência vem como "6/2026".
  const competencia = entrada["Data da Comprovação de Renda"]?.match(/^(\d{1,2})\/(\d{4})$/);

  return {
    kind: "formal",
    sourceDocument: preenchido(entrada["Jurídica"] ?? entrada["Física"]),
    occupation: preenchido(entrada["Ocupação"]),
    startDate: dataIso(entrada["Admissão"]),
    grossCents: preenchido(entrada["Bruta"]),
    netCents: preenchido(entrada["Líquida"]),
    incomeTaxCents: preenchido(entrada["Valor do Imposto de Renda"]),
    proofType: comprovante(root, entrada["Comprovante de Renda"]),
    proofMonth: competencia?.[1],
    proofYear: competencia?.[2],
  };
}

function rendaInformal(entrada: Entrada): SavedIncome {
  return {
    kind: "informal",
    sourceName: preenchido(entrada["Atividade"]),
    startDate: dataIso(entrada["Data Início"]),
    netCents: preenchido(entrada["Renda Liquida"] ?? entrada["Renda Líquida"]),
  };
}

/** Sem campos vazios: o JSON fica menor e a chave de deduplicação, estável. */
function semVazios(renda: SavedIncome): SavedIncome {
  return Object.fromEntries(
    Object.entries(renda).filter(([, valor]) => valor !== undefined),
  ) as unknown as SavedIncome;
}

/** Rendas da lista da tela aberta; `null` quando a tela não tem lista. */
export function readSavedIncomes(root: Document): SavedIncome[] | null {
  const formal = root.querySelector("#comprovada");
  if (formal) return lerEntradas(formal).map((entrada) => semVazios(rendaFormal(root, entrada)));

  const informal = root.querySelector("#informal");
  if (informal) return lerEntradas(informal).map((entrada) => semVazios(rendaInformal(entrada)));

  return null;
}
