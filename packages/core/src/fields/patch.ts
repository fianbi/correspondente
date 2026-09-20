import { DomainError } from "../domain/errors";
import { requireField } from "./catalog";
import type { FieldDef } from "./types";

/** Valor de campo já normalizado, pronto para gravar. */
export type FieldValue = string | number | boolean | null;

export interface FieldChange {
  key: string;
  from: FieldValue;
  to: FieldValue;
}

export interface ParsedPatch {
  values: Record<string, FieldValue>;
  errors: Record<string, string>;
}

/**
 * Valida o que veio do formulário contra o catálogo.
 *
 * Só as chaves informadas são consideradas: quem envia um bloco de uma fase não
 * apaga sem querer os campos das outras.
 */
export function parseFieldPatch(
  raw: Record<string, unknown>,
  allowedKeys: readonly string[],
): ParsedPatch {
  const values: Record<string, FieldValue> = {};
  const errors: Record<string, string> = {};

  for (const key of allowedKeys) {
    if (!(key in raw)) continue;

    const def = requireField(key);
    const result = def.schema.safeParse(raw[key]);

    if (!result.success) {
      errors[key] = result.error.issues[0]?.message ?? "Valor inválido.";
      continue;
    }
    values[key] = (result.data ?? null) as FieldValue;
  }

  return { values, errors };
}

/**
 * Compara valor a valor e devolve só o que mudou de fato.
 *
 * É o coração da auditoria: como toda escrita passa por aqui, o histórico
 * campo-a-campo sai sem nenhum esforço extra de quem escreve a tela — e um
 * "salvar" sem alteração nenhuma não polui o histórico com ruído.
 */
export function diffFieldValues(
  before: Record<string, FieldValue>,
  after: Record<string, FieldValue>,
): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const [key, to] of Object.entries(after)) {
    const from = before[key] ?? null;
    if (!sameValue(from, to)) changes.push({ key, from, to });
  }

  return changes;
}

/** `null`, `undefined` e string vazia são a mesma ausência de valor. */
function sameValue(a: FieldValue | undefined, b: FieldValue | undefined): boolean {
  const normalize = (value: FieldValue | undefined): FieldValue =>
    value === undefined || value === "" ? null : value;
  return normalize(a) === normalize(b);
}

export function assertNoErrors(patch: ParsedPatch): void {
  const first = Object.entries(patch.errors)[0];
  if (first) {
    throw new DomainError(`${requireField(first[0]).label}: ${first[1]}`, "invalid_field");
  }
}

/** Separa o que vai para coluna nativa do que vai para `process_field_values`. */
export function splitByStorage(values: Record<string, FieldValue>): {
  columns: Record<string, FieldValue>;
  stored: Record<string, FieldValue>;
  defs: Record<string, FieldDef>;
} {
  const columns: Record<string, FieldValue> = {};
  const stored: Record<string, FieldValue> = {};
  const defs: Record<string, FieldDef> = {};

  for (const [key, value] of Object.entries(values)) {
    const def = requireField(key);
    defs[key] = def;
    if (def.storage.kind === "column") columns[def.storage.column] = value;
    else stored[key] = value;
  }

  return { columns, stored, defs };
}
