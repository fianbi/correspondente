import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Label({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
      {children}
    </label>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border bg-white px-3 text-sm text-ink placeholder:text-ink-muted/60",
        "focus:border-brand-500 focus:outline-2 focus:outline-offset-0 focus:outline-brand-500/30",
        invalid ? "border-status-reprovado" : "border-line",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  name,
  hint,
  error,
  children,
  ...inputProps
}: InputProps & { label: string; name: string; hint?: string; error?: string; children?: ReactNode }) {
  const id = `field-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children ?? <Input id={id} name={name} invalid={Boolean(error)} {...inputProps} />}
      {error ? (
        <p className="text-xs text-status-reprovado">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
