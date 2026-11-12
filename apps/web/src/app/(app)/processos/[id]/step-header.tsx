"use client";

import { useTransition } from "react";
import type { FieldOption } from "@corr/core";
import { Select } from "@/components/ui/select";
import { assignStageAction } from "./stage-actions";
import type { StepState } from "./stage-form";

/** Título da etapa aberta, com a situação dela e quem é o responsável. */
export function StepHeader({
  processId,
  stepKey,
  label,
  subtitle,
  state,
  assignedTo,
  members,
}: {
  processId: string;
  stepKey: string;
  label: string;
  subtitle: string;
  state: StepState;
  assignedTo: string | null;
  members: FieldOption[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-ink">{label}</h2>
          <StepStateChip state={state} />
        </div>
        <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
      </div>
      <Select
        aria-label="Responsável pela etapa"
        className="h-8 w-48 text-xs"
        placeholder="Sem responsável"
        options={members}
        defaultValue={assignedTo ?? ""}
        disabled={pending}
        onChange={(event) =>
          startTransition(() => void assignStageAction(processId, stepKey, event.target.value))
        }
      />
    </div>
  );
}

export function StepStateChip({ state }: { state: StepState }) {
  const styles = {
    pendente: "bg-surface-muted text-ink-muted",
    atual: "bg-amber-50 text-status-aguardando",
    concluida: "bg-green-50 text-status-aprovado",
  } as const;
  const labels = {
    pendente: "A fazer",
    atual: "Etapa atual",
    concluida: "Concluída",
  } as const;

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[state]}`}>
      {labels[state]}
    </span>
  );
}
