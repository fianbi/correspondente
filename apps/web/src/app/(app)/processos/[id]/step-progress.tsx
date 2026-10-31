"use client";

import { useTransition } from "react";
import { Check, CornerDownLeft, GitBranch, MoveRight } from "lucide-react";
import type { ProcessStepDef } from "@corr/core";
import { Button } from "@/components/ui/button";
import { moveStep } from "../actions";

/**
 * Botões de movimento da etapa que está aberta na tela.
 *
 * Na etapa atual: concluir (vai para a próxima) e abrir os desvios que nascem
 * dela, como o PEPT depois da vistoria. Num desvio, concluir volta para a
 * etapa que o abriu. Em qualquer outra etapa: trazer o processo para ela —
 * processo real anda para trás (novo terreno, vistoria refeita), e quem decide
 * é o operador.
 */
export function StepActions({
  processId,
  step,
  isCurrent,
  next,
  detours,
}: {
  processId: string;
  step: ProcessStepDef;
  isCurrent: boolean;
  next: ProcessStepDef | null;
  detours: ProcessStepDef[];
}) {
  const [pending, startTransition] = useTransition();
  const move = (stepKey: string) => startTransition(() => void moveStep(processId, stepKey));

  if (!isCurrent) {
    return (
      <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => move(step.key)}>
        <MoveRight className="size-4" aria-hidden />
        Mover processo para esta etapa
      </Button>
    );
  }

  return (
    <>
      {detours.map((detour) => (
        <Button
          key={detour.key}
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => move(detour.key)}
          title={detour.hint}
        >
          <GitBranch className="size-4" aria-hidden />
          {detour.label}
        </Button>
      ))}
      {next ? (
        <Button type="button" size="sm" disabled={pending} onClick={() => move(next.key)}>
          {step.conditional ? (
            <CornerDownLeft className="size-4" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          {step.conditional ? `Voltar para ${next.label}` : "Concluir etapa"}
        </Button>
      ) : null}
    </>
  );
}
