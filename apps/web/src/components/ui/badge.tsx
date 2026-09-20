import { PROCESS_STATUS_LABELS, PROCESS_STATUS_TOKENS, type ProcessStatus } from "@corr/core";
import { cn } from "@/lib/utils";

/**
 * Badge de status do processo. A cor vem do token declarado em `globals.css`
 * via `PROCESS_STATUS_TOKENS`, então status e cor mudam juntos num lugar só.
 *
 * As classes são escritas por extenso porque o Tailwind varre o código-fonte:
 * uma classe montada por concatenação não existiria no CSS gerado.
 */
const STATUS_CLASSES: Record<string, string> = {
  aberto: "bg-slate-100 text-status-aberto",
  aguardando: "bg-amber-50 text-status-aguardando",
  aprovado: "bg-green-50 text-status-aprovado",
  condicionado: "bg-yellow-50 text-status-condicionado",
  reprovado: "bg-red-50 text-status-reprovado",
  assinado: "bg-blue-50 text-status-assinado",
  vencido: "bg-rose-50 text-status-vencido",
};

export function StatusBadge({ status }: { status: ProcessStatus }) {
  const token = PROCESS_STATUS_TOKENS[status];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_CLASSES[token] ?? STATUS_CLASSES.aberto,
      )}
    >
      {PROCESS_STATUS_LABELS[status]}
    </span>
  );
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
