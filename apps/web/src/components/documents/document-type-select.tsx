import type { SelectHTMLAttributes } from "react";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_OPTION_GROUPS } from "@corr/core";
import { cn } from "@/lib/utils";

/**
 * Tipo de documento agrupado: dezesseis opções soltas viravam caça ao item;
 * separadas por assunto, o operador acha o RG em "Identificação" de primeira.
 */
export function DocumentTypeSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-line bg-white px-2.5 text-sm text-ink",
        "focus:border-brand-500 focus:outline-2 focus:outline-offset-0 focus:outline-brand-500/30",
        className,
      )}
      {...props}
    >
      {DOCUMENT_TYPE_OPTION_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.types.map((type) => (
            <option key={type} value={type}>
              {DOCUMENT_TYPE_LABELS[type]}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
