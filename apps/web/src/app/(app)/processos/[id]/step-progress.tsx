"use client";

import Link from "next/link";
import type { Route } from "next";
import { useTransition } from "react";
import { Check, CornerDownLeft, GitBranch } from "lucide-react";
import { PROCESS_STAGE_LABELS, PROCESS_STAGES, type ProcessStepDef } from "@corr/core";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { moveStep } from "../actions";

export interface StepTrackProps {
  processId: string;
  trackName: string;
  steps: ProcessStepDef[];
  currentKey: string;
  nextKey: string | null;
  detourKeys: string[];
  /** Desvios (PEPT, pendências) que já aconteceram neste processo. */
  visitedKeys: string[];
}

function useMove(processId: string) {
  const [pending, startTransition] = useTransition();
  const move = (stepKey: string) => startTransition(() => void moveStep(processId, stepKey));
  return { pending, move };
}

/**
 * Faixa do andamento no topo do processo: onde está, quanto falta e o botão
 * para o próximo passo. Fica em todas as abas porque é a pergunta que o
 * operador responde no telefone: "em que pé está o meu financiamento?".
 */
export function StepSummary({
  processId,
  trackName,
  steps,
  currentKey,
  nextKey,
  detourKeys,
}: StepTrackProps) {
  const { pending, move } = useMove(processId);
  const main = steps.filter((step) => !step.conditional || step.key === currentKey);
  const current = steps.find((step) => step.key === currentKey);
  const next = steps.find((step) => step.key === nextKey);
  const detours = steps.filter((step) => detourKeys.includes(step.key));
  const position = main.findIndex((step) => step.key === currentKey) + 1;

  if (!current) return null;

  return (
    <Card className="mb-5">
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Andamento · {trackName}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-ink" data-testid="passo-atual">
              {current.label}
            </p>
            <p className="text-xs text-ink-muted">
              {current.conditional ? "Desvio" : `Passo ${position} de ${main.length}`} ·{" "}
              {current.responsible}
              {current.system ? ` · ${current.system}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {detours.map((detour) => (
              <Button
                key={detour.key}
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
              <Button size="sm" disabled={pending} onClick={() => move(next.key)}>
                {current.conditional ? (
                  <CornerDownLeft className="size-4" aria-hidden />
                ) : (
                  <Check className="size-4" aria-hidden />
                )}
                {current.conditional ? `Voltar para ${next.label}` : "Concluir passo"}
              </Button>
            ) : null}
          </div>
        </div>

        <ol className="flex gap-0.5" aria-label="Progresso do andamento">
          {main.map((step, index) => (
            <li
              key={step.key}
              title={step.label}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                index + 1 < position
                  ? "bg-status-aprovado"
                  : index + 1 === position
                    ? "bg-status-aguardando"
                    : "bg-surface-muted",
              )}
            />
          ))}
        </ol>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
          <span>{next && !current.conditional ? `Próximo: ${next.label}` : current.hint ?? ""}</span>
          <Link
            href={`/processos/${processId}?aba=andamento` as Route}
            className="font-medium text-brand-600 hover:underline"
          >
            Ver todos os passos
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Roteiro completo, agrupado por fase. Qualquer passo pode virar o atual —
 * inclusive voltar —, porque um processo real anda para trás (novo terreno,
 * vistoria refeita) e quem decide é o operador.
 */
export function StepTrackPanel({
  processId,
  trackName,
  steps,
  currentKey,
  visitedKeys,
}: StepTrackProps) {
  const { pending, move } = useMove(processId);
  const currentIndex = steps.findIndex((step) => step.key === currentKey);

  return (
    <Card>
      <CardHeader
        title={`Andamento — ${trackName}`}
        description="O roteiro muda com a modalidade do processo. Passos marcados como desvio só acontecem quando algo volta com pendência."
      />
      <CardBody className="flex flex-col gap-5">
        {PROCESS_STAGES.map((phase) => {
          const phaseSteps = steps.filter((step) => step.phase === phase);
          if (phaseSteps.length === 0) return null;
          return (
            <section key={phase} aria-label={PROCESS_STAGE_LABELS[phase]}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {PROCESS_STAGE_LABELS[phase]}
              </h3>
              <ol className="flex flex-col gap-1">
                {phaseSteps.map((step) => {
                  const index = steps.findIndex((s) => s.key === step.key);
                  const isCurrent = step.key === currentKey;
                  const done = step.conditional
                    ? !isCurrent && visitedKeys.includes(step.key)
                    : index < currentIndex;
                  return (
                    <li
                      key={step.key}
                      className={cn(
                        "flex items-start justify-between gap-3 rounded-md px-3 py-2",
                        isCurrent ? "bg-brand-50" : "hover:bg-surface-muted/60",
                        step.conditional && !isCurrent && !done ? "opacity-70" : null,
                      )}
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        <span
                          aria-hidden
                          className={cn(
                            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                            done
                              ? "bg-status-aprovado text-white"
                              : isCurrent
                                ? "bg-status-aguardando text-white"
                                : "bg-surface-muted text-ink-muted",
                          )}
                        >
                          {done ? <Check className="size-3" /> : step.conditional ? "↺" : ""}
                        </span>
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "text-sm",
                              isCurrent ? "font-semibold text-brand-700" : "text-ink",
                            )}
                          >
                            {step.label}
                            {isCurrent ? <span className="sr-only"> (passo atual)</span> : null}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {step.responsible}
                            {step.hint ? ` · ${step.hint}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {step.conditional ? <Chip>Desvio</Chip> : null}
                        {step.system ? <Chip>{step.system}</Chip> : null}
                        {!isCurrent ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => move(step.key)}
                            aria-label={`Mover andamento para ${step.label}`}
                          >
                            Ir para
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </CardBody>
    </Card>
  );
}
