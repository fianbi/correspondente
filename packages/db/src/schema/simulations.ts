import { sql } from "drizzle-orm";
import { bigint, boolean, date, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { orgs, profiles } from "./orgs";
import { processes } from "./processes";

/** Um cenário simulado: o que o simulador do banco devolveu para uma combinação. */
export interface SimulationScenario {
  financedValueCents: number | null;
  termMonths: number | null;
  amortization: string | null;
  interestRate: string | null;
  firstInstallmentCents: number | null;
  subsidyCents: number | null;
  chosen: boolean;
}

/**
 * Simulação de crédito, antes de existir processo.
 *
 * Fica separada do processo de propósito: a maioria das simulações não vira
 * financiamento, e o cliente que só simulou não tem CPF nem cadastro. Guardar
 * isso como pessoa e processo encheria as duas listas de gente que nunca
 * voltou. Quando o cliente segue, "Abrir processo" cria o processo e aponta
 * `process_id` para ele.
 *
 * As respostas ficam em colunas: são sempre as mesmas sete perguntas, e é
 * assim que dá para filtrar e contar ("quantas simulações acima de 8 mil
 * viraram processo").
 */
export const simulations = pgTable(
  "simulations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),

    clientName: text("client_name").notNull(),
    clientPhone: text("client_phone"),

    oldestBirthDate: date("oldest_birth_date"),
    familyIncomeCents: bigint("family_income_cents", { mode: "number" }),
    fgtsThreeYears: boolean("fgts_three_years"),
    multipleBuyers: boolean("multiple_buyers"),
    propertyValueCents: bigint("property_value_cents", { mode: "number" }),
    hadSubsidy: boolean("had_subsidy"),
    ownsProperty: boolean("owns_property"),

    scenarios: jsonb("scenarios").$type<SimulationScenario[]>().notNull().default([]),
    notes: text("notes"),

    processId: uuid("process_id").references(() => processes.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("simulations_org_updated_idx").on(table.orgId, table.updatedAt),
    index("simulations_process_idx").on(table.processId),
  ],
);

export type Simulation = typeof simulations.$inferSelect;
