"use client";

import { useTransition } from "react";
import { PROCESS_STATUS_LABELS, type ProcessStatus } from "@corr/core";
import { Select, optionsFromLabels, type SelectOption } from "@/components/ui/select";
import { changeStatus, moveStep } from "../actions";

const STATUS_OPTIONS = optionsFromLabels(PROCESS_STATUS_LABELS);

/**
 * Etapa e status ficam no cabeçalho: são do processo inteiro e mudam com um
 * clique — cada troca vira um evento próprio no histórico. As etapas listadas
 * são as do roteiro da modalidade do processo.
 */
export function ProcessHeaderControls({
  processId,
  steps,
  stepKey,
  status,
}: {
  processId: string;
  steps: SelectOption[];
  stepKey: string;
  status: ProcessStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label="Etapa do processo"
        className="h-9 w-64 text-sm"
        placeholder={null}
        options={steps}
        value={stepKey}
        disabled={pending}
        onChange={(event) =>
          startTransition(() => void moveStep(processId, event.target.value))
        }
      />
      <Select
        aria-label="Status do processo"
        className="h-9 w-40 text-sm"
        placeholder={null}
        options={STATUS_OPTIONS}
        value={status}
        disabled={pending}
        onChange={(event) =>
          startTransition(() => void changeStatus(processId, event.target.value))
        }
      />
    </div>
  );
}
