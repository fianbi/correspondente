import { z } from "zod";

/**
 * Tipos de documento que a esteira coleta. A lista sai do que os bancos pedem
 * no crédito imobiliário — e é a mesma lista que o checklist de cada fase usa
 * para saber o que ainda falta.
 */
export const DOCUMENT_TYPES = [
  "rg",
  "cnh",
  "certidao_nascimento",
  "certidao_casamento",
  "comprovante_residencia",
  "comprovante_renda",
  "extrato_fgts",
  "declaracao_ir",
  "carteira_trabalho",
  "ficha_cadastral_banco",
  "matricula_imovel",
  "iptu",
  "contrato_compra_venda",
  "laudo_avaliacao",
  "documento_vendedor",
  "outro",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  rg: "RG",
  cnh: "CNH",
  certidao_nascimento: "Certidão de nascimento",
  certidao_casamento: "Certidão de casamento",
  comprovante_residencia: "Comprovante de residência",
  comprovante_renda: "Comprovante de renda",
  extrato_fgts: "Extrato de FGTS",
  declaracao_ir: "Declaração de imposto de renda",
  carteira_trabalho: "Carteira de trabalho",
  ficha_cadastral_banco: "Ficha cadastral do banco",
  matricula_imovel: "Matrícula do imóvel",
  iptu: "IPTU",
  contrato_compra_venda: "Contrato de compra e venda",
  laudo_avaliacao: "Laudo de avaliação",
  documento_vendedor: "Documento do vendedor",
  outro: "Outro",
};

/** Agrupamento usado para colorir e ordenar a lista de documentos. */
export const DOCUMENT_TYPE_GROUPS: Record<DocumentType, "identidade" | "renda" | "imovel" | "outro"> = {
  rg: "identidade",
  cnh: "identidade",
  certidao_nascimento: "identidade",
  certidao_casamento: "identidade",
  carteira_trabalho: "identidade",
  comprovante_residencia: "renda",
  comprovante_renda: "renda",
  extrato_fgts: "renda",
  declaracao_ir: "renda",
  matricula_imovel: "imovel",
  iptu: "imovel",
  contrato_compra_venda: "imovel",
  laudo_avaliacao: "imovel",
  documento_vendedor: "imovel",
  ficha_cadastral_banco: "outro",
  outro: "outro",
};

export const DOCUMENT_STATUSES = ["recebido", "aprovado", "rejeitado"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  recebido: "Recebido",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

/** De onde o arquivo chegou: importa para saber em quem cobrar o reenvio. */
export const DOCUMENT_SOURCES = ["interno", "portal"] as const;
export type DocumentSource = (typeof DOCUMENT_SOURCES)[number];

export const DOCUMENT_SOURCE_LABELS: Record<DocumentSource, string> = {
  interno: "Enviado pela equipe",
  portal: "Enviado pelo link de acesso",
};

/**
 * Estado da extração automática. As colunas existem desde já para o M3, mas no
 * MVP quem preenche é gente: a IA entra depois, sem migration nem retrabalho.
 */
export const EXTRACTION_STATUSES = ["nao_processado", "pendente", "concluido", "falhou"] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export const PENDENCY_STATUSES = ["aberta", "resolvida"] as const;
export type PendencyStatus = (typeof PENDENCY_STATUSES)[number];

export const PENDENCY_STATUS_LABELS: Record<PendencyStatus, string> = {
  aberta: "Aberta",
  resolvida: "Resolvida",
};

export const documentTypeSchema = z.enum(DOCUMENT_TYPES);
export const documentStatusSchema = z.enum(DOCUMENT_STATUSES);
export const pendencyStatusSchema = z.enum(PENDENCY_STATUSES);

/** Extensões aceitas no upload. */
export const ACCEPTED_UPLOAD_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
] as const;

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function isAcceptedUpload(mimeType: string): boolean {
  return (ACCEPTED_UPLOAD_MIME as readonly string[]).includes(mimeType);
}
