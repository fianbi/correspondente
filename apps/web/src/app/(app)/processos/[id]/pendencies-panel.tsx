"use client";

import { useActionState, useTransition } from "react";
import { Check, RotateCcw } from "lucide-react";
import { PENDENCY_STATUS_LABELS } from "@corr/core";
import type { PendencyRow } from "@corr/db";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { addPendency, togglePendency } from "./pendency-actions";

export function PendenciesPanel({
  processId,
  stageKey,
  pendencies,
}: {
  processId: string;
  stageKey: string | null;
  pendencies: PendencyRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [pendencyState, pendencyAction] = useActionState<{ error?: string }, FormData>(
    addPendency.bind(null, processId, stageKey),
    {},
  );
  return (
      <Card>
        <CardHeader
          title="Pendências"
          description="O que está travando o processo. Aparece também na tela Pendências, junto com as dos outros processos."
        />
        {pendencies.length > 0 ? (
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {[...pendencies]
                .sort((a, b) => (a.status === b.status ? 0 : a.status === "aberta" ? -1 : 1))
                .map((pendency) => (
                <li key={pendency.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        pendency.status === "resolvida"
                          ? "text-ink-muted line-through"
                          : "text-ink",
                      )}
                    >
                      {pendency.title}
                    </p>
                    {pendency.description ? (
                      <p className="text-xs text-ink-muted">{pendency.description}</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {PENDENCY_STATUS_LABELS[pendency.status]}
                      {pendency.createdByName ? ` · aberta por ${pendency.createdByName}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={
                      pendency.status === "aberta" ? "Marcar como resolvida" : "Reabrir pendência"
                    }
                    onClick={() =>
                      startTransition(() =>
                        void togglePendency(processId, pendency.id, pendency.status === "aberta"),
                      )
                    }
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-surface-muted disabled:opacity-40"
                  >
                    {pendency.status === "aberta" ? (
                      <Check className="size-3.5" aria-hidden />
                    ) : (
                      <RotateCcw className="size-3.5" aria-hidden />
                    )}
                    {pendency.status === "aberta" ? "Resolver" : "Reabrir"}
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>
        ) : null}

        <CardBody className={pendencies.length > 0 ? "border-t border-line" : ""}>
          <form action={pendencyAction} className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Label htmlFor="pendency-title">Nova pendência</Label>
              <Input id="pendency-title" name="title" placeholder="Falta comprovante de renda atualizado" />
            </div>
            <SubmitButton size="sm">Adicionar</SubmitButton>
            {pendencyState.error ? (
              <p role="alert" className="w-full text-sm text-status-reprovado">
                {pendencyState.error}
              </p>
            ) : null}
          </form>
        </CardBody>
      </Card>
  );
}
