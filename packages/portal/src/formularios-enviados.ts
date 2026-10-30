/**
 * Leitura da tela "Consulta de Formulários Enviados" do Caixa Aqui.
 *
 * É lá que o operador vê o resultado da avaliação de risco de cada proposta,
 * os detalhes e a validade. Diferente das telas de cadastro, não há campo para
 * ler: os dados estão numa tabela de resultado, uma linha por formulário.
 *
 * As colunas são achadas pelo título, não pela posição: o portal já mostrou
 * colunas a mais ou a menos conforme o convênio, e a ordem mudar não pode
 * trocar a validade pelo resultado sem ninguém perceber.
 *
 * Só lê. Nada aqui escreve no documento.
 */

export interface FormularioEnviado {
  /** "No Prop." da tela; `null` quando o portal mostra "-" (pré-cadastro). */
  proposalNumber: string | null;
  /** Data de remessa, em ISO (aaaa-mm-dd). */
  sentOn: string | null;
  cpf: string | null;
  conformity: string | null;
  product: string | null;
  riskResult: string | null;
  riskDetails: string | null;
  /** Validade da avaliação de risco, em ISO (aaaa-mm-dd). */
  riskValidUntil: string | null;
  requestType: string | null;
}

export interface LeituraFormulariosEnviados {
  /** CPF consultado, só dígitos. */
  cpf: string | null;
  rows: FormularioEnviado[];
}

type Coluna = keyof FormularioEnviado;

/** Título da coluna (sem acento, minúsculo) → campo. A ordem importa: o primeiro que casa vence. */
const TITULOS: [RegExp, Coluna][] = [
  [/^n[o°º]?\.? ?prop/, "proposalNumber"],
  [/data (da )?remessa/, "sentOn"],
  [/cpf/, "cpf"],
  [/conformidade/, "conformity"],
  [/^detalhes? .*avaliacao de risco/, "riskDetails"],
  [/^validade .*avaliacao de risco/, "riskValidUntil"],
  [/^resultado .*avaliacao de risco/, "riskResult"],
  [/^produto/, "product"],
  [/tipo de pedido/, "requestType"],
];

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Texto visível da célula. Junta os pedaços com espaço porque o portal quebra
 * valores com `<br>` ("Solicitação<br>Contratação"), e `textContent` colaria
 * as palavras.
 */
function textoDe(elemento: Element): string | null {
  const partes: string[] = [];
  const visitar = (no: Node) => {
    if (no.nodeType === 3) partes.push(no.nodeValue ?? "");
    else if (no.nodeType === 1) {
      const tag = (no as Element).tagName.toLowerCase();
      if (tag === "script" || tag === "style") return;
      no.childNodes.forEach(visitar);
    }
  };
  visitar(elemento);
  const texto = partes.join(" ").replace(/\s+/g, " ").trim();
  return texto === "" || texto === "-" ? null : texto;
}

function dataIso(texto: string | null): string | null {
  const achada = texto?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return achada ? `${achada[3]}-${achada[2]}-${achada[1]}` : null;
}

function cpfDigitos(texto: string | null | undefined): string | null {
  const digitos = (texto ?? "").replace(/\D+/g, "");
  return digitos.length === 11 ? digitos : null;
}

function colunasDa(tabela: HTMLTableElement): (Coluna | null)[] | null {
  const cabecalho = Array.from(tabela.querySelectorAll("thead th"));
  const titulos = cabecalho.length > 0 ? cabecalho : Array.from(tabela.querySelectorAll("tr:first-child th"));
  const colunas = titulos.map((th) => {
    const titulo = normalizar(th.textContent ?? "");
    return TITULOS.find(([padrao]) => padrao.test(titulo))?.[1] ?? null;
  });
  return colunas.includes("riskResult") ? colunas : null;
}

/** `null` quando o documento não é a tela de formulários enviados. */
export function readSentForms(root: Document): LeituraFormulariosEnviados | null {
  for (const tabela of Array.from(root.querySelectorAll<HTMLTableElement>("table"))) {
    const colunas = colunasDa(tabela);
    if (!colunas) continue;

    const corpo = tabela.tBodies[0] ?? tabela;
    const rows: FormularioEnviado[] = [];
    for (const linha of Array.from(corpo.querySelectorAll(":scope > tr"))) {
      const celulas = Array.from(linha.children).filter((c) => c.tagName.toLowerCase() === "td");
      if (celulas.length === 0) continue;

      const lido: Partial<Record<Coluna, string | null>> = {};
      colunas.forEach((coluna, indice) => {
        const celula = celulas[indice];
        if (coluna && celula) lido[coluna] = textoDe(celula);
      });

      rows.push({
        proposalNumber: lido.proposalNumber?.replace(/\s+/g, "") ?? null,
        sentOn: dataIso(lido.sentOn ?? null),
        cpf: cpfDigitos(lido.cpf),
        conformity: lido.conformity ?? null,
        product: lido.product ?? null,
        riskResult: lido.riskResult ?? null,
        riskDetails: lido.riskDetails ?? null,
        riskValidUntil: dataIso(lido.riskValidUntil ?? null),
        requestType: lido.requestType ?? null,
      });
    }

    // O campo de busca tem o CPF consultado também na página de resultado.
    const busca = root.querySelector<HTMLInputElement>("#cpfCliente");
    const cpf = cpfDigitos(busca?.value) ?? rows.find((r) => r.cpf)?.cpf ?? null;
    return { cpf, rows };
  }
  return null;
}

/** A linha traz avaliação de risco (resultado, detalhes ou validade). */
export function hasRiskAssessment(row: FormularioEnviado): boolean {
  return Boolean(row.riskResult || row.riskDetails || row.riskValidUntil);
}
