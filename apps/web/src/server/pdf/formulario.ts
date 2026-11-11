import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
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
import type { ModeloPronto } from "./modelos";

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
  ["participante.1.assinatura", "Participantes (proponentes e cônjuge) — 1º: nome / CPF"],
  ["proponente.1.assinatura", "Proponentes — 1º: nome / CPF"],
  ["conta.caixa", "Conta corrente da proposta — op.conta-dv"],
  ["local.data", "Local e data por extenso (cidade do escritório, hoje)"],
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
  if (escopo === "participante" || escopo === "proponente") {
    return resolverParticipante(escopo, campo, dados);
  }
  if (escopo === "conta" && campo === "caixa") return contaCaixa(dados);
  if (escopo === "local" && campo === "data") {
    const hoje = dados.hoje ?? new Date();
    const cidade = texto(dados.org.city);
    const data = `${resolverHoje("dia", hoje)} de ${resolverHoje("mes", hoje)} de ${resolverHoje("ano", hoje)}`;
    return cidade ? `${cidade}, ${data}` : data;
  }
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

/**
 * Quem assina pelo financiamento, na ordem dos formulários da Caixa: o
 * proponente principal, os demais proponentes e, só em `participante`, os
 * cônjuges (o cadastrado no processo ou, sem ele, o do cadastro do
 * proponente). Vendedor, anuente e engenheiro não entram.
 */
export function participantesDoFinanciamento(
  dados: DadosParaFormulario,
  soProponentes: boolean,
): { nome: string; cpf: string }[] {
  const participantes = (dados.process.participants ?? []) as Participante[];
  const lista: { nome: string; cpf: string }[] = [];
  const digitos = (cpf: string) => cpf.replace(/\D/g, "");
  const incluir = (nome: string, cpf: string) => {
    if (!nome && !cpf) return;
    if (cpf && lista.some((p) => digitos(p.cpf) === digitos(cpf))) return;
    lista.push({ nome, cpf });
  };

  incluir(texto(dados.person.fullName), texto(dados.person.cpf));
  for (const p of participantes) if (p.role === "coproponente") incluir(p.fullName, p.cpf);
  if (!soProponentes) {
    for (const p of participantes) if (p.role === "conjuge") incluir(p.fullName, p.cpf);
    incluir(texto(dados.person.spouseName), texto(dados.person.spouseCpf));
  }
  return lista;
}

/** `participante.2.nome`, `proponente.1.cpf`, `participante.3.assinatura` (nome / CPF). */
function resolverParticipante(escopo: string, campo: string, dados: DadosParaFormulario): string {
  const [ordem, parte] = campo.split(".");
  const quem = participantesDoFinanciamento(dados, escopo === "proponente")[Number(ordem) - 1];
  if (!quem) return "";
  const cpf = quem.cpf ? formatCpf(quem.cpf) : "";
  if (parte === "nome") return quem.nome;
  if (parte === "cpf") return cpf;
  if (parte === "assinatura") return [quem.nome, cpf].filter(Boolean).join(" / ");
  return "";
}

/** Conta corrente da proposta como a Caixa escreve: operação.conta-DV. */
function contaCaixa(dados: DadosParaFormulario): string {
  const valor = (chave: string) => (dados.fieldValues[chave] ?? "").trim();
  const conta = valor("process.checking_account_number");
  if (!conta) return "";
  const operacao = valor("process.checking_operation");
  const dv = valor("process.checking_dv");
  return `${operacao ? `${operacao}.` : ""}${conta}${dv ? `-${dv}` : ""}`;
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

  // Uma marca por proponente: `marcar.proponente.2` só sai se houver o 2º.
  if (campo.startsWith("proponente.")) {
    const ordem = Number(campo.split(".")[1]);
    return participantesDoFinanciamento(dados, true).length >= ordem;
  }

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
  const fonte = await doc.embedFont(StandardFonts.Helvetica);

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
      const campo = form.getTextField(campoDoPdf);
      campo.setText(valor);

      // Campo estreito (conta, DV) com valor comprido: diminui a letra até
      // caber, em vez de cortar o número.
      const largura = campo.acroField.getWidgets()[0]?.getRectangle().width ?? 0;
      const ocupado = fonte.widthOfTextAtSize(valor, 9);
      if (largura > 0 && ocupado > largura - 3) {
        campo.setFontSize(Math.max(5, Math.floor((9 * (largura - 3)) / ocupado)));
      }
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

/** Tamanho da letra dos formulários da Caixa (Arial 11, que a Helvetica imita). */
const TAMANHO = 11;
const ENTRELINHA = 12;
const PRETO = rgb(0, 0, 0);

/** Quebra o texto em linhas que caibam na largura, sem cortar palavra. */
function quebrar(texto: string, fonte: PDFFont, largura: number, tamanho = TAMANHO): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (atual && fonte.widthOfTextAtSize(tentativa, tamanho) > largura) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export interface Escrita {
  texto: string;
  /** Página do formulário, a partir de 0. */
  pagina: number;
  tamanho: number;
  x: number;
  /** Linha de base, medida do topo da página. */
  base: number;
}

/**
 * O que escrever e onde, num modelo pronto. Separado do desenho para o teste
 * conferir conteúdo e posição sem ler o PDF de volta.
 */
export function planejarModeloPronto(
  modelo: ModeloPronto,
  dados: DadosParaFormulario,
  respostas: Record<string, string>,
  fonte: PDFFont,
): Escrita[] {
  const escritas: Escrita[] = [];
  const valorDe = (rotulo: string, chave: string) =>
    responder(rotulo, chave, respostas) ?? resolverValor(chave, dados);

  for (const item of modelo.itens) {
    const pagina = item.pagina ?? 0;
    if (item.tipo === "marca") {
      if (!valorDe(item.rotulo, item.valor)) continue;
      const largura = fonte.widthOfTextAtSize("X", TAMANHO);
      const altura = fonte.heightAtSize(TAMANHO, { descender: false });
      escritas.push({
        texto: "X",
        pagina,
        tamanho: TAMANHO,
        x: item.x + (item.largura - largura) / 2,
        base: item.topo + item.altura - (item.altura - altura) / 2 - 0.5,
      });
      continue;
    }

    if (item.tipo === "linha") {
      let x = item.x;
      for (const parte of item.partes) {
        // Sem valor, fica uma lacuna para preencher à mão.
        const texto =
          typeof parte === "string" ? parte : resolverValor(parte.valor, dados) || "______";
        escritas.push({ texto, pagina, tamanho: TAMANHO, x, base: item.base });
        x += fonte.widthOfTextAtSize(texto, TAMANHO);
      }
      continue;
    }

    const texto = valorDe(item.rotulo, item.valor);
    if (!texto) continue;

    const tamanho = item.tamanho ?? TAMANHO;
    const entrelinha = (ENTRELINHA * tamanho) / TAMANHO;
    const linhas = item.largura ? quebrar(texto, fonte, item.largura, tamanho) : [texto];
    linhas.forEach((linha, indice) => {
      const largura = fonte.widthOfTextAtSize(linha, tamanho);
      const x =
        item.centralizar && item.largura
          ? item.x + Math.max(0, (item.largura - largura) / 2)
          : item.x;
      escritas.push({ texto: linha, pagina, tamanho, x, base: item.base + indice * entrelinha });
    });
  }

  return escritas;
}

/**
 * Gera um modelo pronto: escreve os valores sobre o fundo do formulário, na
 * letra do próprio formulário. O texto cresce com o conteúdo; onde a largura
 * acaba, desce para a linha de baixo.
 */
export async function desenharModeloPronto(
  modelo: ModeloPronto,
  dados: DadosParaFormulario,
  respostas: Record<string, string> = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(modelo.fundo());
  const fonte = await doc.embedFont(StandardFonts.Helvetica);

  for (const escrita of planejarModeloPronto(modelo, dados, respostas, fonte)) {
    const page = doc.getPage(escrita.pagina);
    page.drawText(escrita.texto, {
      x: escrita.x,
      y: page.getHeight() - escrita.base,
      size: escrita.tamanho,
      font: fonte,
      color: PRETO,
    });
  }

  return doc.save();
}
