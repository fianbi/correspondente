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
}

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

  if (escopo === "process") {
    const direto = dados.process[campo];
    if (direto !== undefined) return formatarProcesso(campo, direto);
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
): Promise<ResultadoPreenchimento> {
  const doc = await PDFDocument.load(modelo, { ignoreEncryption: true });
  const form = doc.getForm();

  const preenchidos: string[] = [];
  const ignorados: string[] = [];

  for (const [campoDoPdf, chave] of Object.entries(fieldMap)) {
    if (!chave) continue;

    const valor = resolverValor(chave, dados);
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
