"use client";

import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { deleteProcessAction } from "../actions";

/**
 * Exclusão do processo. Pede para digitar o número do processo: o número
 * garante que é este processo, não o da aba ao lado.
 */
export function DeleteProcess({ processId, number }: { processId: string; number: number }) {
  return (
    <ConfirmDelete
      title={`Excluir o processo #${number}?`}
      confirmText={String(number)}
      normalize={(value) => value.trim().replace(/^#/, "")}
      confirmHint={`Para confirmar, digite o número do processo (${number}):`}
      confirmLabel="Número do processo para confirmar"
      inputMode="numeric"
      submitLabel="Excluir processo"
      onConfirm={(typed) => deleteProcessAction(processId, typed)}
    >
      Saem junto os dados das etapas, o histórico, as pendências, os links de acesso e os
      documentos que são só do processo. Documentos pessoais continuam no cadastro de cada
      pessoa, e a simulação de origem volta a ficar em aberto. Não dá para desfazer.
    </ConfirmDelete>
  );
}
