import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { FieldBlock, StageRequirement } from "@corr/core";
import { orgs, profiles } from "./orgs";
import { processes } from "./processes";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/**
 * Fluxo de trabalho do escritório. Cada escritório recebe uma cópia do fluxo
 * padrão e pode alterá-la — por isso é tabela, não constante no código.
 */
export const flows = pgTable(
  "flows",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (table) => [unique("flows_org_key_unique").on(table.orgId, table.key)],
);

/**
 * Etapa do fluxo. Os blocos e os campos de cada bloco ficam em JSONB porque são
 * configuração: mudar a tela de uma fase é um UPDATE, não uma migration.
 *
 * `blocks` guarda chaves do catálogo de campos (`@corr/core/fields`) — o seed
 * valida que todas existem.
 */
export const flowStages = pgTable(
  "flow_stages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    flowId: uuid("flow_id")
      .notNull()
      .references(() => flows.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    position: integer("position").notNull(),
    blocks: jsonb("blocks").$type<FieldBlock[]>().notNull().default([]),
    /** Checklist de documentos exigidos nesta etapa. */
    requirements: jsonb("requirements").$type<StageRequirement[]>().notNull().default([]),
    ...timestamps,
  },
  (table) => [
    unique("flow_stages_flow_key_unique").on(table.flowId, table.key),
    index("flow_stages_flow_position_idx").on(table.flowId, table.position),
  ],
);

/**
 * Valor de um campo do catálogo que não tem coluna nativa em `processes`.
 *
 * Guardado como texto: a conversão de tipo é responsabilidade do catálogo, que
 * é quem sabe o que cada chave significa. Uma coluna por campo obrigaria uma
 * migration a cada ajuste de fluxo, que é justamente o que se quer evitar.
 */
export const processFieldValues = pgTable(
  "process_field_values",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => processes.id, { onDelete: "cascade" }),
    fieldKey: text("field_key").notNull(),
    value: text("value"),
    updatedBy: uuid("updated_by").references(() => profiles.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.processId, table.fieldKey] }),
    index("process_field_values_org_idx").on(table.orgId, table.processId),
  ],
);

export const stageState = pgEnum("stage_state", ["pendente", "em_andamento", "concluida"]);

/** Andamento de cada etapa dentro de um processo. */
export const processStageStates = pgTable(
  "process_stage_states",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => processes.id, { onDelete: "cascade" }),
    stageKey: text("stage_key").notNull(),
    state: stageState("state").notNull().default("pendente"),
    assignedTo: uuid("assigned_to").references(() => profiles.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.processId, table.stageKey] })],
);

export const processEventKind = pgEnum("process_event_kind", [
  "campo_alterado",
  "fase_alterada",
  "status_alterado",
  "etapa_iniciada",
  "etapa_finalizada",
  "responsavel_alterado",
  "processo_criado",
  "avaliacao_risco_vinculada",
  "andamento_alterado",
]);

/**
 * Log de auditoria campo-a-campo.
 *
 * Toda escrita em processo passa por `applyProcessPatch`, que calcula o diff e
 * grava aqui. Como é um caminho só, o histórico sai de graça e não depende de
 * ninguém lembrar de registrar a alteração.
 */
export const processEvents = pgTable(
  "process_events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    processId: uuid("process_id")
      .notNull()
      .references(() => processes.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => profiles.id, { onDelete: "set null" }),
    kind: processEventKind("kind").notNull(),
    /** Chave do catálogo, quando o evento é de campo. */
    fieldKey: text("field_key"),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("process_events_process_idx").on(table.orgId, table.processId, table.createdAt)],
);

export type Flow = typeof flows.$inferSelect;
export type FlowStage = typeof flowStages.$inferSelect;
export type ProcessFieldValue = typeof processFieldValues.$inferSelect;
export type ProcessStageState = typeof processStageStates.$inferSelect;
export type ProcessEvent = typeof processEvents.$inferSelect;
