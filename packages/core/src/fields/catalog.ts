import { z } from "zod";
import {
  AMORTIZATION_SYSTEM_LABELS,
  MODALITY_LABELS,
  PROCESS_STATUS_LABELS,
} from "../domain/process";
import {
  optionalDate,
  optionalEnum,
  optionalInt,
  optionalMoney,
  optionalText,
} from "../schemas/helpers";
import type { FieldDef, FieldOption } from "./types";

/** Seleção de registro relacionado: vazio vira `null`, resto tem que ser uuid. */
const uuidOrNull = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullish()
  .transform((value) => value ?? null)
  .refine((value) => value === null || z.uuid().safeParse(value).success, "Seleção inválida.");

const optionsOf = (labels: Record<string, string>): FieldOption[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

const SIM_NAO: FieldOption[] = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
];

const optionalBoolean = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullish()
  .transform((value) => value ?? null)
  .refine((value) => value === null || value === "sim" || value === "nao", "Opção inválida.");

/** Atalho para declarar um campo, já com o schema coerente com o tipo. */
function field(def: Omit<FieldDef, "schema"> & { schema?: z.ZodType }): FieldDef {
  if (def.schema) return def as FieldDef;

  const schema = (() => {
    switch (def.type) {
      case "money":
        return optionalMoney;
      case "int":
        return optionalInt;
      case "date":
      case "datetime":
        return optionalDate;
      case "boolean":
        return optionalBoolean;
      case "select":
        return optionalEnum(
          (def.options ?? []).map((o) => o.value) as unknown as [string, ...string[]],
        );
      default:
        return optionalText;
    }
  })();

  return { ...def, schema };
}

/**
 * Campos do processo. A chave nunca muda depois de publicada: ela aparece na
 * configuração de fluxo de cada escritório, no histórico de auditoria e no
 * mapeamento da extensão.
 */
export const PROCESS_FIELDS: FieldDef[] = [
  // ── Proposta (colunas nativas: entram em listagem, filtro e soma) ────────
  field({
    key: "process.modality",
    label: "Modalidade",
    type: "select",
    options: optionsOf(MODALITY_LABELS),
    storage: { kind: "column", column: "modality" },
  }),
  field({
    key: "process.amortization",
    label: "Sistema de amortização",
    type: "select",
    options: optionsOf(AMORTIZATION_SYSTEM_LABELS),
    storage: { kind: "column", column: "amortizationSystem" },
  }),
  field({
    key: "process.indexer",
    label: "Indexador",
    type: "text",
    placeholder: "TR, IPCA…",
    storage: { kind: "column", column: "indexer" },
  }),
  field({
    key: "process.proposal_number",
    label: "Número da proposta",
    type: "text",
    storage: { kind: "column", column: "proposalNumber" },
  }),
  field({
    key: "process.contract_number",
    label: "Número do contrato",
    type: "text",
    storage: { kind: "column", column: "contractNumber" },
  }),
  field({
    key: "process.property_value",
    label: "Valor do imóvel",
    type: "money",
    storage: { kind: "column", column: "propertyValueCents" },
  }),
  field({
    key: "process.financed_value",
    label: "Valor de financiamento",
    type: "money",
    storage: { kind: "column", column: "financedValueCents" },
  }),
  field({
    key: "process.approved_value",
    label: "Valor aprovado",
    type: "money",
    storage: { kind: "column", column: "approvedValueCents" },
  }),
  field({
    key: "process.subsidy",
    label: "Valor de subsídio",
    type: "money",
    storage: { kind: "column", column: "subsidyCents" },
  }),
  field({
    key: "process.fgts",
    label: "Valor de FGTS",
    type: "money",
    storage: { kind: "column", column: "fgtsCents" },
  }),
  field({
    key: "process.term_months",
    label: "Prazo (meses)",
    type: "int",
    storage: { kind: "column", column: "termMonths" },
  }),
  field({
    key: "process.credit_valid_until",
    label: "Validade do crédito",
    type: "date",
    help: "Alimenta o alerta de processos a vencer.",
    storage: { kind: "column", column: "creditValidUntil" },
  }),
  field({
    key: "process.property_address",
    label: "Endereço do imóvel",
    type: "text",
    storage: { kind: "column", column: "propertyAddress" },
  }),
  field({
    key: "process.property_registration",
    label: "Matrícula do imóvel",
    type: "text",
    storage: { kind: "column", column: "propertyRegistration" },
  }),

  // ── Relações. As opções vêm do banco, por isso `optionsSource`. ─────────
  field({
    key: "process.bank",
    label: "Banco",
    type: "select",
    optionsSource: "banks",
    storage: { kind: "column", column: "bankId" },
    schema: uuidOrNull,
  }),
  field({
    key: "process.agency",
    label: "Agência",
    type: "select",
    optionsSource: "agencies",
    storage: { kind: "column", column: "agencyId" },
    schema: uuidOrNull,
  }),
  field({
    key: "process.broker",
    label: "Corretor",
    type: "select",
    optionsSource: "brokers",
    storage: { kind: "column", column: "brokerId" },
    schema: uuidOrNull,
  }),
  field({
    key: "process.real_estate_agency",
    label: "Imobiliária",
    type: "select",
    optionsSource: "real_estate_agencies",
    storage: { kind: "column", column: "realEstateAgencyId" },
    schema: uuidOrNull,
  }),
  field({
    key: "process.assigned_to",
    label: "Responsável",
    type: "select",
    optionsSource: "members",
    storage: { kind: "column", column: "assignedTo" },
    schema: uuidOrNull,
  }),
  field({
    key: "process.notes",
    label: "Observações",
    type: "textarea",
    storage: { kind: "column", column: "notes" },
  }),

  // ── Análise de crédito (etapa Correspondente) ────────────────────────────
  field({
    key: "credit.authorization_type",
    label: "Tipo de autorização",
    type: "select",
    options: [
      { value: "primeira", label: "1ª autorização" },
      { value: "segunda", label: "2ª autorização" },
    ],
    storage: { kind: "value" },
  }),
  field({
    key: "credit.analysis_status",
    label: "Resultado da análise",
    type: "select",
    options: optionsOf(PROCESS_STATUS_LABELS),
    storage: { kind: "value" },
  }),
  field({
    key: "credit.appraisal_value",
    label: "Valor de avaliação",
    type: "money",
    storage: { kind: "value" },
  }),
  field({
    key: "credit.outstanding_balance",
    label: "Saldo devedor",
    type: "money",
    storage: { kind: "value" },
  }),
  field({
    key: "credit.installment_value",
    label: "Valor da parcela",
    type: "money",
    storage: { kind: "value" },
  }),
  field({
    key: "credit.fgts_three_years",
    label: "Três anos de recolhimento do FGTS",
    type: "boolean",
    options: SIM_NAO,
    storage: { kind: "value" },
  }),
  field({
    key: "credit.analysis_notes",
    label: "Observações da análise",
    type: "textarea",
    storage: { kind: "value" },
  }),

  // ── Montagem (venda cruzada exigida no pacote) ───────────────────────────
  field({
    key: "assembly.origin",
    label: "Origem da adesão",
    type: "select",
    options: [
      { value: "escritorio", label: "Escritório" },
      { value: "agencia", label: "Agência" },
    ],
    storage: { kind: "value" },
  }),
  field({
    key: "assembly.checking_account",
    label: "Conta corrente",
    type: "boolean",
    options: SIM_NAO,
    storage: { kind: "value" },
  }),
  field({
    key: "assembly.overdraft_value",
    label: "Limite de cheque especial",
    type: "money",
    storage: { kind: "value" },
  }),
  field({
    key: "assembly.savings_account",
    label: "Conta poupança",
    type: "boolean",
    options: SIM_NAO,
    storage: { kind: "value" },
  }),
  field({
    key: "assembly.credit_card",
    label: "Cartão de crédito",
    type: "boolean",
    options: SIM_NAO,
    storage: { kind: "value" },
  }),

  // ── Conformidade de contrato ─────────────────────────────────────────────
  field({
    key: "compliance.occurred_at",
    label: "Data de ocorrência",
    type: "date",
    storage: { kind: "value" },
  }),
  field({
    key: "compliance.notes",
    label: "Apontamentos",
    type: "textarea",
    storage: { kind: "value" },
  }),

  // ── Agência ──────────────────────────────────────────────────────────────
  field({
    key: "agency.interview_at",
    label: "Data da entrevista",
    type: "date",
    storage: { kind: "value" },
  }),
  field({
    key: "agency.interview_done",
    label: "Entrevista realizada",
    type: "boolean",
    options: SIM_NAO,
    storage: { kind: "value" },
  }),
  field({
    key: "agency.manager_name",
    label: "Nome do gerente",
    type: "text",
    storage: { kind: "value" },
  }),
  field({
    key: "agency.signature_forecast",
    label: "Previsão de assinatura",
    type: "date",
    storage: { kind: "value" },
  }),
  field({
    key: "agency.signed_at",
    label: "Data da assinatura",
    type: "date",
    storage: { kind: "value" },
  }),
  field({
    key: "agency.contract_signed",
    label: "Contrato assinado",
    type: "boolean",
    options: SIM_NAO,
    storage: { kind: "value" },
  }),
  field({
    key: "agency.used_value",
    label: "Valor utilizado",
    type: "money",
    storage: { kind: "value" },
  }),

  // ── CRI (Cartório de Registro de Imóveis) ────────────────────────────────
  field({
    key: "cri.fees_paid_at",
    label: "Emolumentos pagos em",
    type: "date",
    storage: { kind: "value" },
  }),
  field({
    key: "cri.protocol_number",
    label: "Número do protocolo no RI",
    type: "text",
    storage: { kind: "value" },
  }),
  field({
    key: "cri.protocol_at",
    label: "Data do protocolo",
    type: "date",
    storage: { kind: "value" },
  }),
  field({
    key: "cri.registered_at",
    label: "Registro finalizado em",
    type: "date",
    storage: { kind: "value" },
  }),
];

const BY_KEY = new Map(PROCESS_FIELDS.map((f) => [f.key, f]));

export function getField(key: string): FieldDef | undefined {
  return BY_KEY.get(key);
}

/** Lança se a chave não existe: configuração de fluxo inválida é bug, não dado. */
export function requireField(key: string): FieldDef {
  const def = BY_KEY.get(key);
  if (!def) throw new Error(`Campo desconhecido no catálogo: ${key}`);
  return def;
}

export function allFieldKeys(): string[] {
  return PROCESS_FIELDS.map((f) => f.key);
}
