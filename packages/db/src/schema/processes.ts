import { sql } from "drizzle-orm";
import {
  bigint,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  AMORTIZATION_SYSTEMS,
  MODALITIES,
  PARTICIPANT_ROLES,
  PROCESS_STAGES,
  PROCESS_STATUSES,
} from "@corr/core";
import { agencies, banks, brokers, realEstateAgencies } from "./catalogs";
import { orgs, profiles } from "./orgs";
import { people } from "./people";
import { riskAssessments } from "./risk-assessments";

export const processStage = pgEnum("process_stage", PROCESS_STAGES);
export const processStatus = pgEnum("process_status", PROCESS_STATUSES);
export const modality = pgEnum("modality", MODALITIES);
export const amortizationSystem = pgEnum("amortization_system", AMORTIZATION_SYSTEMS);
export const participantRole = pgEnum("participant_role", PARTICIPANT_ROLES);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/**
 * O processo: um registro que atravessa as fases da esteira.
 *
 * `stage` é a coluna que o Kanban lê. No M2 o fluxo vira configuração e os
 * campos específicos de cada fase saem daqui para `process_field_values`; o que
 * fica nesta tabela é o que vale para o processo inteiro, independente da fase.
 */
export const processes = pgTable(
  "processes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),

    /** Número sequencial por escritório, para citar o processo por telefone. */
    number: integer("number").notNull(),

    /**
     * Proponente principal. Fica desnormalizado aqui (e repetido em
     * `process_participants`) porque toda listagem e todo card do Kanban
     * precisam do nome do cliente: sem a coluna, seria um join a mais por
     * linha para responder "de quem é este processo".
     */
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),

    /**
     * Fluxo que este processo segue. Nulo nos processos criados antes do M2:
     * eles caem no fluxo padrão do escritório na leitura.
     */
    flowId: uuid("flow_id"),

    stage: processStage("stage").notNull().default("cadastro"),
    status: processStatus("status").notNull().default("em_aberto"),

    bankId: uuid("bank_id").references(() => banks.id),
    agencyId: uuid("agency_id").references(() => agencies.id, { onDelete: "set null" }),
    modality: modality("modality"),
    amortizationSystem: amortizationSystem("amortization_system"),
    indexer: text("indexer"),

    contractNumber: text("contract_number"),
    proposalNumber: text("proposal_number"),

    propertyValueCents: bigint("property_value_cents", { mode: "number" }),
    financedValueCents: bigint("financed_value_cents", { mode: "number" }),
    approvedValueCents: bigint("approved_value_cents", { mode: "number" }),
    subsidyCents: bigint("subsidy_cents", { mode: "number" }),
    fgtsCents: bigint("fgts_cents", { mode: "number" }),
    termMonths: integer("term_months"),

    /** Validade do crédito aprovado: alimenta o alerta de "a vencer". */
    creditValidUntil: date("credit_valid_until"),

    /**
     * Avaliação de risco do SICAQ que vale para este processo. A captura da
     * extensão preenche sozinha quando está vazio; o operador pode trocar.
     */
    riskAssessmentId: uuid("risk_assessment_id").references(() => riskAssessments.id, {
      onDelete: "set null",
    }),

    brokerId: uuid("broker_id").references(() => brokers.id, { onDelete: "set null" }),
    realEstateAgencyId: uuid("real_estate_agency_id").references(() => realEstateAgencies.id, {
      onDelete: "set null",
    }),

    assignedTo: uuid("assigned_to").references(() => profiles.id, { onDelete: "set null" }),

    propertyAddress: text("property_address"),
    propertyRegistration: text("property_registration"),

    notes: text("notes"),
    createdBy: uuid("created_by"),
    ...timestamps,
  },
  (table) => [
    unique("processes_org_number_unique").on(table.orgId, table.number),
    index("processes_org_stage_idx").on(table.orgId, table.stage),
    index("processes_org_status_idx").on(table.orgId, table.status),
    index("processes_org_updated_idx").on(table.orgId, table.updatedAt),
    index("processes_org_person_idx").on(table.orgId, table.personId),
  ],
);

/**
 * Pessoas ligadas ao processo. Um financiamento raramente tem um nome só:
 * proponente, cônjuge, coproponente e vendedor convivem no mesmo registro.
 */
export const processParticipants = pgTable(
  "process_participants",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => processes.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    role: participantRole("role").notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.processId, table.personId, table.role] }),
    index("process_participants_person_idx").on(table.orgId, table.personId),
  ],
);

export type Process = typeof processes.$inferSelect;
export type NewProcess = typeof processes.$inferInsert;
export type ProcessParticipant = typeof processParticipants.$inferSelect;
