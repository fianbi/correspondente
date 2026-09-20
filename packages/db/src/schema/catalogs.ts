import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { orgs } from "./orgs";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/**
 * Bancos são referência global (o código COMPE da Caixa é 104 para todo mundo),
 * então esta tabela não tem `org_id` nem RLS por tenant — é lida por todos e
 * escrita só pela conexão administrativa.
 */
export const banks = pgTable("banks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  /** Código COMPE, 3 dígitos. */
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  ...timestamps,
});

/** Agência bancária usada pelo escritório. */
export const agencies = pgTable(
  "agencies",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => banks.id),
    number: text("number").notNull(),
    name: text("name").notNull(),
    city: text("city"),
    uf: text("uf"),
    email: text("email"),
    phone: text("phone"),
    ...timestamps,
  },
  (table) => [unique("agencies_org_bank_number_unique").on(table.orgId, table.bankId, table.number)],
);

/** Imobiliária parceira. */
export const realEstateAgencies = pgTable(
  "real_estate_agencies",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    cnpj: text("cnpj"),
    creci: text("creci"),
    email: text("email"),
    phone: text("phone"),
    city: text("city"),
    uf: text("uf"),
    ...timestamps,
  },
  (table) => [index("real_estate_agencies_org_name_idx").on(table.orgId, table.name)],
);

/** Corretor de imóveis; pode ou não estar vinculado a uma imobiliária. */
export const brokers = pgTable(
  "brokers",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    realEstateAgencyId: uuid("real_estate_agency_id").references(() => realEstateAgencies.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    cpf: text("cpf"),
    creci: text("creci"),
    email: text("email"),
    phone: text("phone"),
    ...timestamps,
  },
  (table) => [index("brokers_org_name_idx").on(table.orgId, table.name)],
);

export type Bank = typeof banks.$inferSelect;
export type Agency = typeof agencies.$inferSelect;
export type RealEstateAgency = typeof realEstateAgencies.$inferSelect;
export type Broker = typeof brokers.$inferSelect;
