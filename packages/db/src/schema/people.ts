import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  EDUCATION_LEVELS,
  HOUSING_SITUATIONS,
  ID_DOCUMENT_TYPES,
  INCOME_KINDS,
  INCOME_PROOF_TYPES,
  MARITAL_STATUSES,
  NATIONALITIES,
  PROPERTY_TYPES,
  SEXES,
} from "@corr/core";
import { orgs } from "./orgs";

export const sex = pgEnum("sex", SEXES);
export const maritalStatus = pgEnum("marital_status", MARITAL_STATUSES);
export const educationLevel = pgEnum("education_level", EDUCATION_LEVELS);
export const nationality = pgEnum("nationality", NATIONALITIES);
export const idDocumentType = pgEnum("id_document_type", ID_DOCUMENT_TYPES);
export const propertyType = pgEnum("property_type", PROPERTY_TYPES);
export const housingSituation = pgEnum("housing_situation", HOUSING_SITUATIONS);
export const incomeKind = pgEnum("income_kind", INCOME_KINDS);
export const incomeProofType = pgEnum("income_proof_type", INCOME_PROOF_TYPES);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/**
 * Cadastro mestre de pessoa física, por escritório.
 *
 * É deliberadamente separado do "cliente do processo": a mesma pessoa volta em
 * vários financiamentos ao longo dos anos, e o histórico dela não pode ficar
 * preso a um processo. O `unique(org_id, cpf)` é o que garante isso na prática.
 *
 * Os campos vão além do óbvio porque o cadastro do banco exige: nome dos pais,
 * PIS, documento com órgão emissor e validade, naturalidade, grau de instrução.
 * Ver `docs/portais/caixa-sicaq.md`.
 */
export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),

    /** Só dígitos — é a chave de deduplicação. */
    cpf: text("cpf").notNull(),
    fullName: text("full_name").notNull(),
    /** O SICAQ limita o nome reduzido a 25 caracteres. */
    shortName: text("short_name"),
    birthDate: date("birth_date"),
    sex: sex("sex"),
    nationality: nationality("nationality"),
    birthUf: text("birth_uf"),
    birthCity: text("birth_city"),
    motherName: text("mother_name"),
    fatherName: text("father_name"),
    educationLevel: educationLevel("education_level"),
    pis: text("pis"),

    docType: idDocumentType("doc_type"),
    docNumber: text("doc_number"),
    docIssuer: text("doc_issuer"),
    docIssuerUf: text("doc_issuer_uf"),
    docIssuedAt: date("doc_issued_at"),
    docValidUntil: date("doc_valid_until"),
    // Campos que existem só em alguns tipos de documento no portal do banco:
    // CNH pede a data da primeira habilitação, passaporte pede o país de
    // origem. Sem eles o preenchimento para no meio da tela.
    docFirstLicenseDate: date("doc_first_license_date"),
    docIssuerCountry: text("doc_issuer_country"),
    /** Só para nacionalidade estrangeira. */
    nationalityCountry: text("nationality_country"),

    maritalStatus: maritalStatus("marital_status"),
    spouseCpf: text("spouse_cpf"),
    spouseName: text("spouse_name"),

    email: text("email"),
    /** Só dígitos com DDD. */
    phone: text("phone"),

    // Endereço residencial. Fica embutido porque o portal modela uma única
    // residência por pessoa; vira tabela própria se aparecer necessidade real
    // de histórico de endereços.
    zipCode: text("zip_code"),
    streetType: text("street_type"),
    street: text("street"),
    streetNumber: text("street_number"),
    complement: text("complement"),
    district: text("district"),
    city: text("city"),
    uf: text("uf"),
    propertyType: propertyType("property_type"),
    housingSituation: housingSituation("housing_situation"),
    /** Mês/ano do comprovante de residência aceito pelo banco. */
    residenceProofMonth: integer("residence_proof_month"),
    residenceProofYear: integer("residence_proof_year"),

    // Grupo familiar, como a Caixa pede no cadastro do cliente: dependentes
    // sem renda e a média das despesas mensais fixas.
    dependentsCount: integer("dependents_count"),
    rentCents: bigint("rent_cents", { mode: "number" }),
    condoFeeCents: bigint("condo_fee_cents", { mode: "number" }),
    alimonyCents: bigint("alimony_cents", { mode: "number" }),

    // Declaração de propósitos da relação com a Caixa. `null` é "não
    // respondido", diferente de "não".
    purposeAccounts: boolean("purpose_accounts"),
    purposeLoans: boolean("purpose_loans"),
    /** Só existe quando há empréstimos e financiamentos. */
    purposeHousingLoan: boolean("purpose_housing_loan"),
    purposeInvestments: boolean("purpose_investments"),
    purposeCreditCard: boolean("purpose_credit_card"),
    purposeInsurance: boolean("purpose_insurance"),
    purposeForeignExchange: boolean("purpose_foreign_exchange"),

    // Agência de relacionamento do cliente na Caixa, como o portal mostra.
    relationshipAgencyNumber: text("relationship_agency_number"),
    relationshipAgencyCity: text("relationship_agency_city"),
    relationshipAgencyUf: text("relationship_agency_uf"),

    notes: text("notes"),
    createdBy: uuid("created_by"),
    ...timestamps,
  },
  (table) => [
    unique("people_org_cpf_unique").on(table.orgId, table.cpf),
    index("people_org_name_idx").on(table.orgId, table.fullName),
  ],
);

/**
 * Renda é lista, não campo: a mesma pessoa pode ter salário, aluguel e
 * benefício ao mesmo tempo, e o banco quer cada fonte separada com seu próprio
 * comprovante.
 */
export const personIncomes = pgTable(
  "person_incomes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),

    kind: incomeKind("kind").notNull(),

    /** Formal: fonte pagadora. Informal: nome da atividade. */
    sourceName: text("source_name"),
    /** CPF ou CNPJ da fonte pagadora, só dígitos. */
    sourceDocument: text("source_document"),
    occupation: text("occupation"),
    startDate: date("start_date"),

    /** Centavos — ver `Cents` em @corr/core. */
    grossCents: bigint("gross_cents", { mode: "number" }),
    netCents: bigint("net_cents", { mode: "number" }),
    incomeTaxCents: bigint("income_tax_cents", { mode: "number" }),

    proofType: incomeProofType("proof_type"),
    /** Competência do comprovante (o portal pede MM/AAAA). */
    proofMonth: integer("proof_month"),
    proofYear: integer("proof_year"),

    previousJobYears: integer("previous_job_years"),
    previousJobMonths: integer("previous_job_months"),

    notes: text("notes"),
    ...timestamps,
  },
  (table) => [index("person_incomes_person_idx").on(table.orgId, table.personId)],
);

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type PersonIncome = typeof personIncomes.$inferSelect;
export type NewPersonIncome = typeof personIncomes.$inferInsert;
