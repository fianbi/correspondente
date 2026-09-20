"use client";

import { useTransition } from "react";
import {
  PROCESS_STAGE_LABELS,
  PROCESS_STATUS_LABELS,
  type ProcessStage,
  type ProcessStatus,
} from "@corr/core";
import { Select, optionsFromLabels } from "@/components/ui/select";
import { changeStatus, moveStage } from "../actions";

const STAGE_OPTIONS = optionsFromLabels(PROCESS_STAGE_LABELS);
const STATUS_OPTIONS = optionsFromLabels(PROCESS_STATUS_LABELS);

/**
 * Fase e status ficam no cabeçalho, fora do formulário da etapa: são do
 * processo inteiro, não de uma etapa, e mudam com um clique — cada troca vira
 * um evento próprio no histórico.
 */
export function ProcessHeaderControls({
  processId,
  stage,
  status,
}: {
  processId: string;
  stage: ProcessStage;
  status: ProcessStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label="Fase do processo"
        className="h-9 w-48 text-sm"
        placeholder={null}
        options={STAGE_OPTIONS}
        value={stage}
        disabled={pending}
        onChange={(event) =>
          startTransition(() => void moveStage(processId, event.target.value))
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
