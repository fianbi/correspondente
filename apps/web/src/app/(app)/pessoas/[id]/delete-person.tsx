"use client";

import { nomeParaConfirmar } from "@corr/core";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { deletePersonAction } from "../actions";

/** Exclusão do cadastro. Pede o primeiro nome, para não apagar a pessoa errada. */
export function DeletePerson({
  personId,
  fullName,
  processCount,
}: {
  personId: string;
  fullName: string;
  processCount: number;
}) {
  const primeiroNome = fullName.trim().split(/\s+/)[0] ?? "";
  return (
    <ConfirmDelete
      title={`Excluir ${fullName}?`}
      blockedReason={
        processCount > 0
          ? `Essa pessoa está em ${processCount} processo(s). Tire ela dos processos (ou exclua os processos) antes de excluir o cadastro.`
          : undefined
      }
      confirmText={primeiroNome}
      normalize={nomeParaConfirmar}
      confirmHint={`Para confirmar, digite o primeiro nome (${primeiroNome}):`}
      confirmLabel="Primeiro nome para confirmar"
      submitLabel="Excluir pessoa"
      onConfirm={(typed) => deletePersonAction(personId, typed)}
    >
      Saem junto as rendas, as avaliações de risco e os documentos do cadastro. Não dá para
      desfazer.
    </ConfirmDelete>
  );
}
