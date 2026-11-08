"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteProcessAction } from "../actions";

/**
 * Exclusão do processo. Não tem volta, então pede para digitar o número do
 * processo — confirmar com um clique é fácil demais de fazer sem querer, e o
 * número garante que é este processo, não o da aba ao lado.
 */
export function DeleteProcess({ processId, number }: { processId: string; number: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const matches = typed.trim().replace(/^#/, "") === String(number);

  const close = () => {
    dialog.current?.close();
    setTyped("");
    setError(null);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 text-status-reprovado hover:text-status-reprovado"
        onClick={() => dialog.current?.showModal()}
      >
        <Trash2 className="size-4" aria-hidden />
        Excluir
      </Button>

      <dialog
        ref={dialog}
        aria-labelledby="excluir-processo-titulo"
        className="m-auto w-full max-w-md rounded-lg border border-line bg-surface p-0 shadow-xl backdrop:bg-black/40"
        onClose={close}
      >
        <form
          className="flex flex-col gap-4 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!matches) return;
            startTransition(async () => {
              const result = await deleteProcessAction(processId, typed);
              if (result?.error) setError(result.error);
            });
          }}
        >
          <h2 id="excluir-processo-titulo" className="text-base font-semibold text-ink">
            Excluir o processo #{number}?
          </h2>
          <p className="text-sm text-ink-muted">
            Saem junto os dados das etapas, o histórico, as pendências, os links de acesso e os
            documentos que são só do processo. Documentos pessoais continuam no cadastro de cada
            pessoa, e a simulação de origem volta a ficar em aberto. Não dá para desfazer.
          </p>
          <label className="flex flex-col gap-1.5 text-sm text-ink">
            Para confirmar, digite o número do processo ({number}):
            <input
              autoFocus
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              inputMode="numeric"
              aria-label="Número do processo para confirmar"
              className="h-10 rounded-md border border-line bg-white px-3 text-sm text-ink focus:border-brand-500 focus:outline-2 focus:outline-brand-500/30"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-status-reprovado">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" disabled={!matches || pending}>
              Excluir processo
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
