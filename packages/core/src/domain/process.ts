import { z } from "zod";

/**
 * Fases da esteira. No M2 o fluxo vira configuração por escritório (tabelas
 * `flows`/`stages`); até lá, este é o fluxo padrão, derivado do funil observado
 * no mercado: Cadastro → Correspondente → Montagem → Conformidade → Agência → CRI.
 */
export const PROCESS_STAGES = [
  "cadastro",
  "correspondente",
  "montagem",
  "conformidade_contrato",
  "agencia",
  "cri",
] as const;
export type ProcessStage = (typeof PROCESS_STAGES)[number];
export const PROCESS_STAGE_LABELS: Record<ProcessStage, string> = {
  cadastro: "Cadastro",
  correspondente: "Correspondente",
  montagem: "Montagem",
  conformidade_contrato: "Conformidade de contrato",
  agencia: "Agência",
  cri: "CRI",
};

/** Situação do processo, independente da fase em que ele está. */
export const PROCESS_STATUSES = [
  "em_aberto",
  "aguardando",
  "aprovado",
  "condicionado",
  "reprovado",
  "assinado",
  "vencido",
  "pausado",
  "cancelado",
  "concluido",
] as const;
export type ProcessStatus = (typeof PROCESS_STATUSES)[number];
export const PROCESS_STATUS_LABELS: Record<ProcessStatus, string> = {
  em_aberto: "Em aberto",
  aguardando: "Aguardando",
  aprovado: "Aprovado",
  condicionado: "Condicionado",
  reprovado: "Reprovado",
  assinado: "Assinado",
  vencido: "Vencido",
  pausado: "Pausado",
  cancelado: "Cancelado",
  concluido: "Concluído",
};

/** Cor de cada status (token CSS definido em `globals.css`). */
export const PROCESS_STATUS_TOKENS: Record<ProcessStatus, string> = {
  em_aberto: "aberto",
  aguardando: "aguardando",
  aprovado: "aprovado",
  condicionado: "condicionado",
  reprovado: "reprovado",
  assinado: "assinado",
  vencido: "vencido",
  pausado: "aberto",
  cancelado: "reprovado",
  concluido: "aprovado",
};

/** Status que tiram o processo da esteira ativa. */
export const CLOSED_STATUSES: readonly ProcessStatus[] = [
  "reprovado",
  "cancelado",
  "concluido",
];

export const MODALITIES = [
  "aquisicao_imovel_novo",
  "aquisicao_imovel_usado",
  "aquisicao_terreno",
  "construcao",
  "aquisicao_terreno_construcao",
  "reforma_ampliacao",
  "emprestimo_garantia_imovel",
  "transferencia_financiamento",
] as const;
export type Modality = (typeof MODALITIES)[number];
export const MODALITY_LABELS: Record<Modality, string> = {
  aquisicao_imovel_novo: "Aquisição de imóvel novo",
  aquisicao_imovel_usado: "Aquisição de imóvel usado",
  aquisicao_terreno: "Aquisição de terreno",
  construcao: "Construção em terreno próprio",
  aquisicao_terreno_construcao: "Aquisição de terreno e construção",
  reforma_ampliacao: "Reforma e ampliação",
  emprestimo_garantia_imovel: "Empréstimo com garantia de imóvel",
  transferencia_financiamento: "Transferência de financiamento",
};

export const AMORTIZATION_SYSTEMS = ["price", "sac"] as const;
export type AmortizationSystem = (typeof AMORTIZATION_SYSTEMS)[number];
export const AMORTIZATION_SYSTEM_LABELS: Record<AmortizationSystem, string> = {
  price: "PRICE",
  sac: "SAC",
};

/** Papel de uma pessoa dentro de um processo. */
export const PARTICIPANT_ROLES = [
  "proponente",
  "coproponente",
  "conjuge",
  "vendedor",
  "anuente",
] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];
export const PARTICIPANT_ROLE_LABELS: Record<ParticipantRole, string> = {
  proponente: "Proponente",
  coproponente: "Coproponente",
  conjuge: "Cônjuge",
  vendedor: "Vendedor",
  anuente: "Anuente",
};

export const processStageSchema = z.enum(PROCESS_STAGES);
export const processStatusSchema = z.enum(PROCESS_STATUSES);
export const modalitySchema = z.enum(MODALITIES);
export const amortizationSystemSchema = z.enum(AMORTIZATION_SYSTEMS);
export const participantRoleSchema = z.enum(PARTICIPANT_ROLES);
