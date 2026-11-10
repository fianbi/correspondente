import "server-only";

import { PDFDocument } from "pdf-lib";
import {
  formatBRL,
  formatCpf,
  formatPhone,
  getField,
  MODALITY_LABELS,
  PROCESS_STAGE_LABELS,
  PROCESS_STATUS_LABELS,
  type Modality,
  type ProcessStage,
  type ProcessStatus,
} from "@corr/core";
import { ehChaveInterna, responder } from "../../lib/formularios";

/**
 * Preenchimento de formulário do banco a partir de um PDF modelo.
 *
 * O modelo é o PDF em branco que o banco distribui, com campos de formulário
 * (AcroForm). O escritório liga cada campo do PDF a uma chave do catálogo uma
 * vez; daí em diante, gerar o formulário de um processo é instantâneo — em vez
 * de alguém redigitar o cadastro inteiro a cada proposta.
 */

/** Nomes dos campos de formulário do PDF, para a tela de mapeamento. */
export async function detectarCampos(pdf: ArrayBuffer): Promise<string[]> {
  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });
  return doc
    .getForm()
    .getFields()
    .map((campo) => campo.getName());
}

export interface DadosParaFormulario {
  person: Record<string, unknown>;
  process: Record<string, unknown>;
  org: Record<string, unknown>;
  fieldValues: Record<string, string | null>;
  /** Rendas do proponente: decidem as marcas de renda formal/informal. */
  incomes?: { kind: string }[];
  /** Data que vai no "Local/data". Padrão: hoje. */
  hoje?: Date;
}

/**
 * Chaves calculadas, que não são um campo do cadastro: coobrigado, data de
 * hoje e marcas "X" dos quadradinhos dos formulários do banco.
 */
export const CHAVES_CALCULADAS: [string, string][] = [
  ["coobrigado.fullName", "Coobrigado — nome (2º proponente ou cônjuge)"],
  ["coobrigado.cpf", "Coobrigado — CPF"],
  ["hoje.data", "Hoje — data (dd/mm/aaaa)"],
  ["hoje.dia", "Hoje — dia"],
  ["hoje.mes", "Hoje — mês por extenso"],
  ["hoje.ano", "Hoje — ano"],
  ["marcar.sempre", "Marcar X — sempre"],
  ["marcar.renda_formal", "Marcar X — tem renda formal"],
  ["marcar.renda_informal", "Marcar X — tem renda informal"],
  ["marcar.conta_corrente", "Marcar X — tem conta corrente na proposta"],
  ["marcar.conta_poupanca", "Marcar X — abre conta poupança"],
  ["marcar.cheque_especial", "Marcar X — tem cheque especial"],
  ["marcar.cartao_credito", "Marcar X — pede cartão de crédito"],
];

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/**
 * Resolve uma chave do catálogo no texto que vai para o PDF.
 *
 * O formulário do banco é papel: tudo vira texto formatado como uma pessoa
 * escreveria — CPF com pontos, dinheiro com R$, data em dd/mm/aaaa.
 */
export function resolverValor(chave: string, dados: DadosParaFormulario): string {
  const [escopo, ...resto] = chave.split(".");
  const campo = resto.join(".");

  if (escopo === "person") return formatarPessoa(campo, dados.person[campo]);
  if (escopo === "org") return texto(dados.org[campo]);
  if (escopo === "coobrigado") return resolverCoobrigado(campo, dados);
  if (escopo === "hoje") return resolverHoje(campo, dados.hoje ?? new Date());
  if (escopo === "marcar") return resolverMarca(campo, dados) ? "X" : "";

  if (escopo === "process") {
    // Campo do catálogo guardado em coluna: a chave é snake_case
    // (`process.contract_number`), a coluna é camelCase (`contractNumber`).
    const def = getField(chave);
    const coluna = def?.storage.kind === "column" ? def.storage.column : campo;
    const direto = dados.process[coluna];
    if (direto !== undefined) return formatarProcesso(coluna, direto);
  }

  // Campos de etapa vivem na tabela de valores, com a chave inteira.
  const guardado = dados.fieldValues[chave];
  if (guardado !== undefined && guardado !== null) {
    const def = getField(chave);
    if (def?.type === "money") return formatBRL(Number(guardado));
    if (def?.type === "date") return dataBr(guardado);
    return guardado;
  }

  return "";
}

interface Participante {
  fullName: string;
  cpf: string;
  role: string;
}

/**
 * Coobrigado do formulário: o 2º proponente do processo; sem ele, o cônjuge
 * do cadastro do proponente.
 */
function resolverCoobrigado(campo: string, dados: DadosParaFormulario): string {
  const participantes = (dados.process.participants ?? []) as Participante[];
  const segundo = participantes.find((p) => p.role === "coproponente");

  const nome = segundo?.fullName ?? texto(dados.person.spouseName);
  const cpf = segundo?.cpf ?? texto(dados.person.spouseCpf);

  if (campo === "fullName") return nome;
  if (campo === "cpf") return cpf ? formatCpf(cpf) : "";
  return "";
}

function resolverHoje(campo: string, hoje: Date): string {
  // Data no fuso de Brasília: o servidor roda em UTC e, depois das 21h, já
  // seria "amanhã".
  const [ano, mes, dia] = hoje
    .toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
    .split("-");
  if (campo === "dia") return dia ?? "";
  if (campo === "mes") return MESES[Number(mes) - 1] ?? "";
  if (campo === "ano") return ano ?? "";
  if (campo === "data") return `${dia}/${mes}/${ano}`;
  return "";
}

function resolverMarca(campo: string, dados: DadosParaFormulario): boolean {
  const valor = (chave: string) => dados.fieldValues[chave] ?? null;
  const rendas = dados.incomes ?? [];

  switch (campo) {
    case "sempre":
      return true;
    case "renda_formal":
      return rendas.some((renda) => renda.kind === "formal");
    case "renda_informal":
      return rendas.some((renda) => renda.kind !== "formal");
    case "conta_corrente":
      return (
        Boolean(valor("process.checking_account_number")) ||
        valor("assembly.checking_account") === "sim"
      );
    case "conta_poupanca":
      return valor("assembly.savings_account") === "sim";
    case "cartao_credito":
      return valor("assembly.credit_card") === "sim";
    case "cheque_especial":
      return Number(valor("assembly.overdraft_value") ?? 0) > 0;
    default:
      return false;
  }
}

function texto(valor: unknown): string {
  return valor === null || valor === undefined ? "" : String(valor);
}

function dataBr(valor: string): string {
  const [ano, mes, dia] = valor.split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : valor;
}

function formatarPessoa(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "";

  switch (campo) {
    case "cpf":
    case "spouseCpf":
      return formatCpf(String(valor));
    case "phone":
      return formatPhone(String(valor));
    case "birthDate":
    case "docIssuedAt":
    case "docValidUntil":
    case "docFirstLicenseDate":
      return dataBr(String(valor));
    default:
      return String(valor);
  }
}

function formatarProcesso(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "";

  if (campo.endsWith("Cents")) return formatBRL(Number(valor));
  if (campo === "modality") return MODALITY_LABELS[valor as Modality] ?? String(valor);
  if (campo === "stage") return PROCESS_STAGE_LABELS[valor as ProcessStage] ?? String(valor);
  if (campo === "status") return PROCESS_STATUS_LABELS[valor as ProcessStatus] ?? String(valor);
  if (campo === "creditValidUntil") return dataBr(String(valor));

  return String(valor);
}

export interface ResultadoPreenchimento {
  pdf: Uint8Array;
  preenchidos: string[];
  ignorados: string[];
}

export async function preencherFormulario(
  modelo: ArrayBuffer,
  fieldMap: Record<string, string>,
  dados: DadosParaFormulario,
  /** Respostas da tela de geração, para os campos perguntados ao gerar. */
  respostas: Record<string, string> = {},
): Promise<ResultadoPreenchimento> {
  const doc = await PDFDocument.load(modelo, { ignoreEncryption: true });
  const form = doc.getForm();

  const preenchidos: string[] = [];
  const ignorados: string[] = [];

  for (const [campoDoPdf, chave] of Object.entries(fieldMap)) {
    if (!chave || ehChaveInterna(campoDoPdf)) continue;

    const valor = responder(campoDoPdf, chave, respostas) ?? resolverValor(chave, dados);
    if (valor === "") {
      ignorados.push(campoDoPdf);
      continue;
    }

    try {
      form.getTextField(campoDoPdf).setText(valor);
      preenchidos.push(campoDoPdf);
    } catch {
      // Campo que sumiu do modelo ou não é de texto (caixa, assinatura). O
      // formulário sai mesmo assim: melhor entregar 90% preenchido do que
      // recusar o documento inteiro por causa de um campo.
      ignorados.push(campoDoPdf);
    }
  }

  // O PDF continua editável de propósito: o operador precisa poder corrigir na
  // agência sem voltar ao sistema.
  form.updateFieldAppearances();

  return { pdf: await doc.save(), preenchidos, ignorados };
}
