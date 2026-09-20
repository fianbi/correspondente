"use client";

import type { FieldOption, FieldView } from "@corr/core";
import { toInputValue } from "@corr/core";
import { Field, Label } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

/** Opções que vêm do banco, resolvidas pela página e passadas para cá. */
export type DynamicOptions = Partial<Record<string, FieldOption[]>>;

/**
 * Renderiza um campo do catálogo.
 *
 * É o único lugar que sabe transformar `FieldDef` em `<input>`. Campo novo no
 * catálogo aparece na tela sem tocar em componente nenhum — que é o ponto de
 * ter catálogo.
 */
export function FieldInput({
  def,
  value,
  options,
  error,
}: {
  def: FieldView;
  value: string | number | null;
  options?: DynamicOptions;
  error?: string;
}) {
  const id = `field-${def.key}`;
  const current = toInputValue(def, value ?? null);

  if (def.type === "select" || def.type === "boolean") {
    const list = def.optionsSource ? (options?.[def.optionsSource] ?? []) : (def.options ?? []);

    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>{def.label}</Label>
        <Select
          id={id}
          name={def.key}
          options={list}
          defaultValue={current}
          invalid={Boolean(error)}
        />
        {error ? (
          <p className="text-xs text-status-reprovado">{error}</p>
        ) : def.help ? (
          <p className="text-xs text-ink-muted">{def.help}</p>
        ) : null}
      </div>
    );
  }

  if (def.type === "textarea") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>{def.label}</Label>
        <textarea
          id={id}
          name={def.key}
          rows={3}
          defaultValue={current}
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-2 focus:outline-brand-500/30"
        />
        {error ? <p className="text-xs text-status-reprovado">{error}</p> : null}
      </div>
    );
  }

  const inputType = def.type === "date" ? "date" : "text";
  const inputMode =
    def.type === "money" ? "decimal" : def.type === "int" ? "numeric" : undefined;

  return (
    <Field
      label={def.label}
      name={def.key}
      type={inputType}
      inputMode={inputMode}
      defaultValue={current}
      placeholder={def.placeholder}
      maxLength={def.maxLength}
      hint={def.help}
      error={error}
    />
  );
}
