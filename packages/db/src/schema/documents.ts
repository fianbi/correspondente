import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  DOCUMENT_SOURCES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  EXTRACTION_STATUSES,
  PENDENCY_STATUSES,
} from "@corr/core";
import { orgs, profiles } from "./orgs";
import { people } from "./people";
import { processes } from "./processes";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const documentType = pgEnum("document_type", DOCUMENT_TYPES);
export const documentStatus = pgEnum("document_status", DOCUMENT_STATUSES);
export const documentSource = pgEnum("document_source", DOCUMENT_SOURCES);
export const extractionStatus = pgEnum("extraction_status", EXTRACTION_STATUSES);
export const pendencyStatus = pgEnum("pendency_status", PENDENCY_STATUSES);

/**
 * Documento recebido. O arquivo mora no Storage do Supabase; aqui ficam só o
 * caminho e os metadados — inclusive de quem veio, porque saber em quem cobrar
 * o reenvio é metade do trabalho de conferência.
 */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    processId: uuid("process_id").references(() => processes.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),

    type: documentType("type").notNull().default("outro"),
    title: text("title").notNull(),
    /** Caminho dentro do bucket privado. Nunca é URL pública. */
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),

    status: documentStatus("status").notNull().default("recebido"),
    source: documentSource("source").notNull().default("interno"),
    /** Etapa em que o documento foi pedido, quando veio de um checklist. */
    stageKey: text("stage_key"),

    uploadedBy: uuid("uploaded_by").references(() => profiles.id, { onDelete: "set null" }),
    /** Nome informado por quem enviou pelo link público (não tem conta). */
    uploadedByName: text("uploaded_by_name"),

    reviewedBy: uuid("reviewed_by").references(() => profiles.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),

    // Estrutura pronta para a extração automática entrar depois sem migration.
    extractedJson: jsonb("extracted_json"),
    extraction: extractionStatus("extraction").notNull().default("nao_processado"),

    ...timestamps,
  },
  (table) => [
    index("documents_org_process_idx").on(table.orgId, table.processId),
    index("documents_org_person_idx").on(table.orgId, table.personId),
  ],
);

/**
 * Pendência: o que falta para o processo andar.
 *
 * Aparece dentro da etapa e também numa visão global, que é como o escritório
 * enxerga tudo que está travado sem abrir processo por processo.
 */
export const pendencies = pgTable(
  "pendencies",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => processes.id, { onDelete: "cascade" }),
    stageKey: text("stage_key"),

    title: text("title").notNull(),
    description: text("description"),
    status: pendencyStatus("status").notNull().default("aberta"),
    pinned: boolean("pinned").notNull().default(false),
    dueDate: timestamp("due_date", { withTimezone: true }),

    assignedTo: uuid("assigned_to").references(() => profiles.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    resolvedBy: uuid("resolved_by").references(() => profiles.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    index("pendencies_org_status_idx").on(table.orgId, table.status),
    index("pendencies_org_process_idx").on(table.orgId, table.processId),
  ],
);

/**
 * Link de acesso para terceiros (cliente, corretor, imobiliária).
 *
 * Guarda só o hash do token: quem tiver acesso de leitura ao banco não
 * consegue entrar no portal de ninguém. O token cru existe uma única vez, na
 * URL entregue a quem vai usar.
 */
export const accessLinks = pgTable(
  "access_links",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => processes.id, { onDelete: "cascade" }),

    tokenHash: text("token_hash").notNull().unique(),
    /** Para quem o link foi gerado — aparece no histórico de acessos. */
    label: text("label").notNull(),
    canUpload: boolean("can_upload").notNull().default(true),

    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastAccessAt: timestamp("last_access_at", { withTimezone: true }),
    accessCount: integer("access_count").notNull().default(0),

    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [index("access_links_org_process_idx").on(table.orgId, table.processId)],
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Pendency = typeof pendencies.$inferSelect;
export type AccessLink = typeof accessLinks.$inferSelect;

/**
 * Mapeamento de campo ensinado pelo operador.
 *
 * Os perfis dos portais nascem versionados no código, mas quando o banco muda
 * a tela o escritório não pode ficar esperando release: o que for ensinado
 * aqui entra na frente do perfil embutido.
 */
export const siteMappings = pgTable(
  "site_mappings",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    portalKey: text("portal_key").notNull(),
    screenKey: text("screen_key").notNull(),
    dataKey: text("data_key").notNull(),
    selector: text("selector").notNull(),
    transform: text("transform"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    unique("site_mappings_unique").on(table.orgId, table.portalKey, table.screenKey, table.dataKey),
    index("site_mappings_screen_idx").on(table.orgId, table.portalKey, table.screenKey),
  ],
);

export type SiteMapping = typeof siteMappings.$inferSelect;

/**
 * Modelo de formulário em PDF do banco.
 *
 * O arquivo em branco fica no Storage; `fieldMap` liga cada campo do PDF a uma
 * chave do catálogo. Gerar o formulário preenchido vira, então, uma operação
 * de dados — e não mais alguém redigitando o cadastro inteiro num PDF.
 */
export const formTemplates = pgTable(
  "form_templates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    storagePath: text("storage_path").notNull(),
    /** Campo do PDF -> chave do catálogo. */
    fieldMap: jsonb("field_map").$type<Record<string, string>>().notNull().default({}),
    /** Campos do PDF detectados no upload, para a tela de mapeamento. */
    detectedFields: jsonb("detected_fields").$type<string[]>().notNull().default([]),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [index("form_templates_org_idx").on(table.orgId, table.name)],
);

export type FormTemplate = typeof formTemplates.$inferSelect;
