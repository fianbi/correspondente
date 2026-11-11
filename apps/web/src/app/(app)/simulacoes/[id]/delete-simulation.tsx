"use client";

import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { deleteSimulationAction } from "../actions";

/** Exclusão da simulação. O processo que nasceu dela, se houver, continua igual. */
export function DeleteSimulation({
  simulationId,
  clientName,
  processNumber,
}: {
  simulationId: string;
  clientName: string;
  processNumber: number | null;
}) {
  return (
    <ConfirmDelete
      title={`Excluir a simulação de ${clientName}?`}
      submitLabel="Excluir simulação"
      onConfirm={() => deleteSimulationAction(simulationId)}
    >
      {processNumber
        ? `O processo #${processNumber}, aberto a partir dela, continua igual. `
        : ""}
      Não dá para desfazer.
    </ConfirmDelete>
  );
}
