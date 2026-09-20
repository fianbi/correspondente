import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./field";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly SelectOption[];
  /** Texto da opção vazia. `null` remove a opção vazia (campo obrigatório). */
  placeholder?: string | null;
  invalid?: boolean;
}

export function Select({ options, placeholder = "—", className, invalid, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border bg-white px-2.5 text-sm text-ink",
        "focus:border-brand-500 focus:outline-2 focus:outline-offset-0 focus:outline-brand-500/30",
        invalid ? "border-status-reprovado" : "border-line",
        className,
      )}
      {...props}
    >
      {placeholder === null ? null : <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function SelectField({
  label,
  name,
  hint,
  error,
  ...selectProps
}: SelectProps & { label: string; name: string; hint?: string; error?: string }) {
  const id = `field-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} name={name} invalid={Boolean(error)} {...selectProps} />
      {error ? (
        <p className="text-xs text-status-reprovado">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Converte um mapa `valor -> rótulo` do domínio em opções de `<select>`. */
export function optionsFromLabels<T extends string>(labels: Record<T, string>): SelectOption[] {
  return (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));
}
