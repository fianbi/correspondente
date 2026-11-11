"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Botão "Excluir" com a janela de confirmação. Exclusão não tem volta: quando
 * `confirmText` vem, o botão final só libera depois de a pessoa digitar o que
 * identifica o registro (número do processo, nome da pessoa), para não apagar
 * o da aba ao lado sem querer.
 */
export function ConfirmDelete({
  title,
  children,
  confirmLabel,
  confirmText,
  confirmHint,
  normalize = (value) => value.trim().toLowerCase(),
  submitLabel,
  onConfirm,
  inputMode,
  blockedReason,
}: {
  title: string;
  children: ReactNode;
  /** Rótulo do campo de confirmação; também é o nome acessível dele. */
  confirmLabel?: string;
  /** O que precisa ser digitado. Sem isto, basta confirmar. */
  confirmText?: string;
  /** Texto mostrado acima do campo (ex.: "digite o número do processo (12)"). */
  confirmHint?: string;
  normalize?: (value: string) => string;
  submitLabel: string;
  onConfirm: (typed: string) => Promise<{ error?: string } | void>;
  inputMode?: "numeric" | "text";
  /** Quando não dá para excluir agora: a janela explica o porquê e não pede nada. */
  blockedReason?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const matches = confirmText === undefined || normalize(typed) === normalize(confirmText);
  const titleId = `excluir-${submitLabel.replace(/\W+/g, "-").toLowerCase()}`;

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
        aria-labelledby={titleId}
        className="m-auto w-full max-w-md rounded-lg border border-line bg-surface p-0 shadow-xl backdrop:bg-black/40"
        onClose={close}
      >
        <form
          className="flex flex-col gap-4 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!matches) return;
            startTransition(async () => {
              const result = await onConfirm(typed);
              if (result?.error) setError(result.error);
            });
          }}
        >
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          {blockedReason ? (
            <p className="text-sm text-ink">{blockedReason}</p>
          ) : (
            <div className="text-sm text-ink-muted">{children}</div>
          )}
          {confirmText !== undefined && !blockedReason ? (
            <label className="flex flex-col gap-1.5 text-sm text-ink">
              {confirmHint}
              <input
                autoFocus
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                inputMode={inputMode}
                aria-label={confirmLabel}
                className="h-10 rounded-md border border-line bg-white px-3 text-sm text-ink focus:border-brand-500 focus:outline-2 focus:outline-brand-500/30"
              />
            </label>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-status-reprovado">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>
              {blockedReason ? "Fechar" : "Cancelar"}
            </Button>
            {blockedReason ? null : (
              <Button type="submit" variant="danger" disabled={!matches || pending}>
                {submitLabel}
              </Button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
