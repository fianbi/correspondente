import { sql } from "drizzle-orm";
import { date, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { orgs, profiles } from "./orgs";
import { people } from "./people";

/**
 * Avaliação de risco feita no SICAQ, como aparece na tela "Consulta de
 * Formulários Enviados" do Caixa Aqui.
 *
 * Pertence à pessoa (o portal avalia o CPF), não ao processo: a mesma
 * avaliação serve ao processo que o escritório abrir para ela, e o processo
 * aponta para a que vale (`processes.risk_assessment_id`).
 *
 * Os valores ficam como o portal mostra, em texto: "APROVADA", "CONDICIONADA"
 * e os detalhes variam de convênio para convênio, e traduzir para um enum
 * agora seria adivinhar o que o banco ainda vai inventar.
 */
export const riskAssessments = pgTable(
  "risk_assessments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),

    /** "No Prop." da tela: é o que identifica a avaliação entre uma leitura e outra. */
    proposalNumber: text("proposal_number").notNull(),
    sentOn: date("sent_on"),
    product: text("product"),
    conformity: text("conformity"),
    result: text("result"),
    details: text("details"),
    validUntil: date("valid_until"),
    requestType: text("request_type"),

    /** Última vez que a tela foi lida com esta linha. */
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    capturedBy: uuid("captured_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("risk_assessments_person_proposal_unique").on(
      table.orgId,
      table.personId,
      table.proposalNumber,
    ),
    index("risk_assessments_org_person_idx").on(table.orgId, table.personId),
  ],
);

export type RiskAssessment = typeof riskAssessments.$inferSelect;
