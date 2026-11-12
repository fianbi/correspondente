"use client";

import { useTransition } from "react";
import { PROCESS_STATUS_LABELS, type ProcessStatus } from "@corr/core";
import { Select, optionsFromLabels } from "@/components/ui/select";
import { changeStatus } from "../actions";

const STATUS_OPTIONS = optionsFromLabels(PROCESS_STATUS_LABELS);

/**
 * Status no cabeçalho: é do processo inteiro e muda com um clique. A etapa
 * anda pela barra de etapas e pelo botão de concluir, logo abaixo.
 */
export function ProcessHeaderControls({
  processId,
  status,
}: {
  processId: string;
  status: ProcessStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      aria-label="Status do processo"
      className="h-9 w-40 text-sm"
      placeholder={null}
      options={STATUS_OPTIONS}
      value={status}
      disabled={pending}
      onChange={(event) => startTransition(() => void changeStatus(processId, event.target.value))}
    />
  );
}
