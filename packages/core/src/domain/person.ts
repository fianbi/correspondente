import { z } from "zod";

/**
 * Domínio de pessoa física modelado a partir do que os portais dos bancos
 * exigem de verdade (o cadastro do Caixa Aqui/SICAQ é o mais completo mapeado
 * até aqui — ver `docs/portais/caixa-sicaq.md`).
 *
 * Os valores são nossos e legíveis; o código que cada banco usa fica em
 * `@corr/core/portais`. Guardar o código do banco aqui amarraria o modelo à
 * Caixa e quebraria quando entrar Itaú ou Bradesco.
 */

export const SEXES = ["masculino", "feminino"] as const;
export type Sex = (typeof SEXES)[number];
export const SEX_LABELS: Record<Sex, string> = {
  masculino: "Masculino",
  feminino: "Feminino",
};

/**
 * "Casado" não é um estado só: o regime de bens muda quem precisa assinar o
 * contrato e se o cônjuge entra como coproponente obrigatório.
 */
export const MARITAL_STATUSES = [
  "solteiro",
  "casado_comunhao_parcial",
  "casado_comunhao_total",
  "casado_separacao_bens",
  "divorciado",
  "separado_judicialmente",
  "viuvo",
  "uniao_estavel",
] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];
export const MARITAL_STATUS_LABELS: Record<MaritalStatus, string> = {
  solteiro: "Solteiro(a)",
  casado_comunhao_parcial: "Casado(a) — comunhão parcial de bens",
  casado_comunhao_total: "Casado(a) — comunhão total de bens",
  casado_separacao_bens: "Casado(a) — separação de bens",
  divorciado: "Divorciado(a)",
  separado_judicialmente: "Separado(a) judicialmente",
  viuvo: "Viúvo(a)",
  uniao_estavel: "União estável",
};

/** Estados em que o cônjuge/companheiro é exigido no cadastro do banco. */
export function requiresSpouse(status: MaritalStatus): boolean {
  return status.startsWith("casado") || status === "uniao_estavel";
}

export const EDUCATION_LEVELS = [
  "fundamental_ate_4a_incompleto",
  "fundamental_4a_completo",
  "fundamental_5a_8a_incompleto",
  "fundamental_completo",
  "medio_incompleto",
  "medio_completo",
  "superior_incompleto",
  "superior_completo",
  "pos_graduacao",
  "mestrado",
  "doutorado",
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  fundamental_ate_4a_incompleto: "Até 4ª série incompleta do ensino fundamental",
  fundamental_4a_completo: "4ª série completa do ensino fundamental",
  fundamental_5a_8a_incompleto: "5ª a 8ª série incompleta do ensino fundamental",
  fundamental_completo: "Ensino fundamental completo",
  medio_incompleto: "Ensino médio incompleto",
  medio_completo: "Ensino médio completo",
  superior_incompleto: "Superior incompleto",
  superior_completo: "Superior completo",
  pos_graduacao: "Especialização / pós-graduação",
  mestrado: "Mestrado",
  doutorado: "Doutorado",
};

export const NATIONALITIES = [
  "brasileiro",
  "brasileiro_naturalizado",
  "brasileiro_nascido_exterior",
  "estrangeiro",
] as const;
export type Nationality = (typeof NATIONALITIES)[number];
export const NATIONALITY_LABELS: Record<Nationality, string> = {
  brasileiro: "Brasileiro(a)",
  brasileiro_naturalizado: "Brasileiro(a) naturalizado(a)",
  brasileiro_nascido_exterior: "Brasileiro(a) nascido(a) no exterior",
  estrangeiro: "Estrangeiro(a)",
};

export const ID_DOCUMENT_TYPES = ["rg", "cnh", "passaporte", "ric"] as const;
export type IdDocumentType = (typeof ID_DOCUMENT_TYPES)[number];
export const ID_DOCUMENT_TYPE_LABELS: Record<IdDocumentType, string> = {
  rg: "RG / Carteira de identidade",
  cnh: "CNH",
  passaporte: "Passaporte",
  ric: "RIC — Registro de Identidade Civil",
};

export const PROPERTY_TYPES = ["casa", "apartamento", "sitio", "chacara", "fazenda", "outro"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  sitio: "Sítio",
  chacara: "Chácara",
  fazenda: "Fazenda",
  outro: "Outro",
};

/** Situação de moradia — entra na análise de crédito, não é só endereço. */
export const HOUSING_SITUATIONS = [
  "propria_quitada",
  "propria_financiada_caixa",
  "propria_financiada_outras",
  "alugada",
  "mora_com_pais",
  "cedida",
  "funcional",
  "outro",
] as const;
export type HousingSituation = (typeof HOUSING_SITUATIONS)[number];
export const HOUSING_SITUATION_LABELS: Record<HousingSituation, string> = {
  propria_quitada: "Própria quitada",
  propria_financiada_caixa: "Própria financiada pela Caixa",
  propria_financiada_outras: "Própria financiada por outra instituição",
  alugada: "Alugada",
  mora_com_pais: "Mora com pais/parentes",
  cedida: "Cedida",
  funcional: "Funcional",
  outro: "Outro",
};

export const INCOME_KINDS = ["formal", "informal"] as const;
export type IncomeKind = (typeof INCOME_KINDS)[number];
export const INCOME_KIND_LABELS: Record<IncomeKind, string> = {
  formal: "Formal",
  informal: "Informal",
};

export const INCOME_PROOF_TYPES = [
  "contracheque",
  "historico_contracheque",
  "declaracao_ir",
  "declaracao_empregador",
  "decore",
  "decore_com_darf",
  "extrato_conta_salario",
  "extrato_beneficio_previdenciario",
  "extrato_fgts",
  "extrato_aplicacao",
  "contrato_aluguel",
  "contrato_estagio",
  "notas_fiscais_rural",
  "rpa",
  "recolhimento_iss",
  "sentenca_judicial",
  "recebimento_exterior",
] as const;
export type IncomeProofType = (typeof INCOME_PROOF_TYPES)[number];
export const INCOME_PROOF_TYPE_LABELS: Record<IncomeProofType, string> = {
  contracheque: "Contracheque / holerite",
  historico_contracheque: "Histórico de contracheque",
  declaracao_ir: "Declaração de imposto de renda",
  declaracao_empregador: "Declaração do empregador / previdenciária",
  decore: "DECORE",
  decore_com_darf: "DECORE com DARF",
  extrato_conta_salario: "Extrato de conta salário / aposentadoria",
  extrato_beneficio_previdenciario: "Extrato de benefício previdenciário",
  extrato_fgts: "Extrato de FGTS",
  extrato_aplicacao: "Extrato de aplicação financeira / poupança",
  contrato_aluguel: "Contrato de aluguel",
  contrato_estagio: "Contrato de estágio",
  notas_fiscais_rural: "Notas fiscais de venda (atividade rural)",
  rpa: "Recibo de pagamento a autônomo (RPA)",
  recolhimento_iss: "Recolhimento de ISS",
  sentenca_judicial: "Sentença judicial",
  recebimento_exterior: "Comprovante de recebimento no exterior",
};

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;
export type UF = (typeof UFS)[number];

export const sexSchema = z.enum(SEXES);
export const maritalStatusSchema = z.enum(MARITAL_STATUSES);
export const educationLevelSchema = z.enum(EDUCATION_LEVELS);
export const nationalitySchema = z.enum(NATIONALITIES);
export const idDocumentTypeSchema = z.enum(ID_DOCUMENT_TYPES);
export const propertyTypeSchema = z.enum(PROPERTY_TYPES);
export const housingSituationSchema = z.enum(HOUSING_SITUATIONS);
export const incomeKindSchema = z.enum(INCOME_KINDS);
export const incomeProofTypeSchema = z.enum(INCOME_PROOF_TYPES);
export const ufSchema = z.enum(UFS);
