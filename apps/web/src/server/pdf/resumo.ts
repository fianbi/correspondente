import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  MODALITY_LABELS,
  PARTICIPANT_ROLE_LABELS,
  PROCESS_STATUS_LABELS,
  formatBRL,
  formatCnpj,
  formatCpf,
  formatPhone,
  type Modality,
  type ParticipantRole,
  type ProcessStatus,
} from "@corr/core";

/**
 * Resumo do processo em PDF.
 *
 * É o documento que o correspondente leva para a agência e anexa ao dossiê.
 * Gerado a partir dos dados, não de um modelo: o que muda de escritório para
 * escritório é o cabeçalho, e isso vem do cadastro.
 */

export interface ResumoInput {
  org: {
    name: string;
    cnpj: string | null;
    internalCode: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    addressLine: string | null;
  };
  process: {
    number: number;
    /** Rótulo da etapa atual, já resolvido pelo roteiro da modalidade. */
    step: string;
    status: ProcessStatus;
    modality: Modality | null;
    indexer: string | null;
    amortization: string | null;
    contractNumber: string | null;
    proposalNumber: string | null;
    propertyValueCents: number | null;
    financedValueCents: number | null;
    approvedValueCents: number | null;
    subsidyCents: number | null;
    fgtsCents: number | null;
    termMonths: number | null;
    creditValidUntil: string | null;
    propertyAddress: string | null;
    propertyRegistration: string | null;
    bankName: string | null;
    agencyName: string | null;
    brokerName: string | null;
    createdAt: Date;
  };
  participants: { fullName: string; cpf: string; role: ParticipantRole }[];
}

const MARGEM = 48;
const LARGURA = 595.28; // A4 retrato
const ALTURA = 841.89;

const TINTA = rgb(0.06, 0.11, 0.16);
const TINTA_CLARA = rgb(0.36, 0.42, 0.5);
const MARCA = rgb(0.12, 0.3, 0.53);
const LINHA = rgb(0.89, 0.91, 0.93);

/** Caneta que desce pela página e quebra em nova folha quando acaba o espaço. */
class Caneta {
  private page: PDFPage;
  private y: number;

  constructor(
    private readonly doc: PDFDocument,
    private readonly regular: PDFFont,
    private readonly negrito: PDFFont,
  ) {
    this.page = doc.addPage([LARGURA, ALTURA]);
    this.y = ALTURA - MARGEM;
  }

  private garantirEspaco(altura: number) {
    if (this.y - altura >= MARGEM) return;
    this.page = this.doc.addPage([LARGURA, ALTURA]);
    this.y = ALTURA - MARGEM;
  }

  titulo(texto: string) {
    this.garantirEspaco(30);
    this.page.drawText(texto, {
      x: MARGEM,
      y: this.y - 18,
      size: 18,
      font: this.negrito,
      color: TINTA,
    });
    this.y -= 30;
  }

  secao(texto: string) {
    this.garantirEspaco(30);
    this.y -= 10;
    this.page.drawText(texto.toUpperCase(), {
      x: MARGEM,
      y: this.y - 10,
      size: 9,
      font: this.negrito,
      color: MARCA,
    });
    this.y -= 16;
    this.page.drawLine({
      start: { x: MARGEM, y: this.y },
      end: { x: LARGURA - MARGEM, y: this.y },
      thickness: 0.5,
      color: LINHA,
    });
    this.y -= 12;
  }

  /** Duas colunas de rótulo e valor: é o formato que cabe em A4 sem apertar. */
  paresEmColunas(pares: [string, string][]) {
    const meio = LARGURA / 2;

    for (let i = 0; i < pares.length; i += 2) {
      this.garantirEspaco(26);
      const linha = pares.slice(i, i + 2);

      linha.forEach(([rotulo, valor], coluna) => {
        const x = coluna === 0 ? MARGEM : meio;
        this.page.drawText(rotulo, { x, y: this.y, size: 7.5, font: this.regular, color: TINTA_CLARA });
        this.page.drawText(valor || "—", {
          x,
          y: this.y - 12,
          size: 10,
          font: this.negrito,
          color: TINTA,
          maxWidth: meio - MARGEM - 12,
        });
      });

      this.y -= 28;
    }
  }

  linhaDeLista(esquerda: string, direita: string) {
    this.garantirEspaco(18);
    this.page.drawText(esquerda, { x: MARGEM, y: this.y, size: 10, font: this.regular, color: TINTA });
    this.page.drawText(direita, {
      x: LARGURA - MARGEM - this.regular.widthOfTextAtSize(direita, 10),
      y: this.y,
      size: 10,
      font: this.regular,
      color: TINTA_CLARA,
    });
    this.y -= 16;
  }

  rodape(texto: string) {
    for (const page of this.doc.getPages()) {
      page.drawText(texto, {
        x: MARGEM,
        y: MARGEM / 2,
        size: 7.5,
        font: this.regular,
        color: TINTA_CLARA,
      });
    }
  }
}

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const DATA_HORA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function dataBr(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

export async function gerarResumoPdf(input: ResumoInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Processo ${input.process.number}`);
  doc.setCreator(input.org.name);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const caneta = new Caneta(doc, regular, negrito);

  caneta.titulo(`Processo #${input.process.number}`);

  caneta.secao("Escritório");
  caneta.paresEmColunas([
    ["Nome", input.org.name],
    ["CNPJ", input.org.cnpj ? formatCnpj(input.org.cnpj) : "—"],
    ["Código do correspondente", input.org.internalCode ?? "—"],
    ["Cidade", input.org.city ?? "—"],
    ["E-mail", input.org.email ?? "—"],
    ["Telefone", input.org.phone ? formatPhone(input.org.phone) : "—"],
  ]);

  caneta.secao("Situação");
  caneta.paresEmColunas([
    ["Etapa atual", input.process.step],
    ["Status", PROCESS_STATUS_LABELS[input.process.status]],
    ["Aberto em", DATA.format(input.process.createdAt)],
    ["Validade do crédito", dataBr(input.process.creditValidUntil)],
  ]);

  caneta.secao("Proposta");
  caneta.paresEmColunas([
    ["Banco", input.process.bankName ?? "—"],
    ["Agência", input.process.agencyName ?? "—"],
    ["Modalidade", input.process.modality ? MODALITY_LABELS[input.process.modality] : "—"],
    ["Sistema de amortização", input.process.amortization?.toUpperCase() ?? "—"],
    ["Indexador", input.process.indexer ?? "—"],
    ["Prazo", input.process.termMonths ? `${input.process.termMonths} meses` : "—"],
    ["Número da proposta", input.process.proposalNumber ?? "—"],
    ["Número do contrato", input.process.contractNumber ?? "—"],
  ]);

  caneta.secao("Valores");
  caneta.paresEmColunas([
    ["Valor do imóvel", formatBRL(input.process.propertyValueCents)],
    ["Valor de financiamento", formatBRL(input.process.financedValueCents)],
    ["Valor aprovado", formatBRL(input.process.approvedValueCents)],
    ["Subsídio", formatBRL(input.process.subsidyCents)],
    ["FGTS", formatBRL(input.process.fgtsCents)],
  ]);

  caneta.secao("Imóvel");
  caneta.paresEmColunas([
    ["Endereço", input.process.propertyAddress ?? "—"],
    ["Matrícula", input.process.propertyRegistration ?? "—"],
  ]);

  caneta.secao("Pessoas do processo");
  for (const participante of input.participants) {
    caneta.linhaDeLista(
      `${participante.fullName} — ${formatCpf(participante.cpf)}`,
      PARTICIPANT_ROLE_LABELS[participante.role],
    );
  }

  if (input.process.brokerName) {
    caneta.secao("Parceiros");
    caneta.linhaDeLista(input.process.brokerName, "Corretor");
  }

  // A data de emissão no rodapé importa: um resumo impresso ontem pode estar
  // desatualizado hoje, e quem recebe precisa saber disso.
  caneta.rodape(
    `${input.org.name} · resumo emitido em ${DATA_HORA.format(new Date())} · documento gerado pelo sistema`,
  );

  return doc.save();
}
