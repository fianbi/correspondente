import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { ORG_ROLES } from "@corr/core";

export const orgRole = pgEnum("org_role", ORG_ROLES);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/** Escritório de correspondente bancário: a unidade de tenancy do sistema. */
export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  /** Só dígitos, como todo documento no sistema. */
  cnpj: text("cnpj").unique(),
  /** Código do correspondente junto ao banco (aparece nos formulários). */
  internalCode: text("internal_code"),
  email: text("email"),
  phone: text("phone"),
  city: text("city"),
  addressLine: text("address_line"),
  logoPath: text("logo_path"),
  ...timestamps,
});

/**
 * Espelho de `auth.users`. O FK e o trigger que cria a linha no signup vivem na
 * migration `0001_tenancy.sql` — o drizzle-kit não deve gerenciar o schema `auth`.
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  avatarPath: text("avatar_path"),
  ...timestamps,
});

/** Vínculo usuário ↔ escritório. Um usuário pode operar mais de um escritório. */
export const orgMembers = pgTable(
  "org_members",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: orgRole("role").notNull().default("operacional"),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.orgId, table.userId] }),
    index("org_members_user_idx").on(table.userId),
  ],
);

/**
 * Contadores sequenciais por escritório (hoje só o número do processo).
 *
 * Uma sequence do Postgres seria global e deixaria buracos entre escritórios;
 * o `update ... returning` nesta linha serializa os concorrentes pelo lock de
 * linha e entrega numeração contínua, que é o que o operador espera ao citar
 * "o processo 37" no telefone.
 */
export const orgCounters = pgTable("org_counters", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => orgs.id, { onDelete: "cascade" }),
  nextProcessNumber: integer("next_process_number").notNull().default(1),
});

export type Org = typeof orgs.$inferSelect;
export type NewOrg = typeof orgs.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type OrgMember = typeof orgMembers.$inferSelect;
