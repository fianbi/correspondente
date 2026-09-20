"use client";

import { useActionState, useTransition } from "react";
import { Check, Play } from "lucide-react";
import type { FieldOption, FieldView } from "@corr/core";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldInput, type DynamicOptions } from "@/components/fields/field-input";
import {
  assignStageAction,
  finishStageAction,
  saveStageFields,
  startStageAction,
  type StageFormState,
} from "./stage-actions";

export interface RenderBlock {
  key: string;
  title: string;
  description?: string;
  fields: { def: FieldView; value: string | number | null }[];
}

export function StageForm({
  processId,
  stageKey,
  stageLabel,
  blocks,
  options,
  state: stageState,
  assignedTo,
  members,
}: {
  processId: string;
  stageKey: string;
  stageLabel: string;
  blocks: RenderBlock[];
  options: DynamicOptions;
  state: "pendente" | "em_andamento" | "concluida";
  assignedTo: string | null;
  members: FieldOption[];
}) {
  const action = saveStageFields.bind(null, processId, stageKey);
  const [formState, formAction] = useActionState<StageFormState, FormData>(action, {});
  const [pending, startTransition] = useTransition();

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-ink">{stageLabel}</h2>
          <StageStateChip state={stageState} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Responsável pela etapa"
            className="h-8 w-44 text-xs"
            options={members}
            defaultValue={assignedTo ?? ""}
            disabled={pending}
            onChange={(event) =>
              startTransition(() => void assignStageAction(processId, stageKey, event.target.value))
            }
          />
          {stageState === "concluida" ? null : stageState === "em_andamento" ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => startTransition(() => void finishStageAction(processId, stageKey))}
            >
              <Check className="size-4" aria-hidden />
              Finalizar etapa
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => startTransition(() => void startStageAction(processId, stageKey))}
            >
              <Play className="size-4" aria-hidden />
              Iniciar etapa
            </Button>
          )}
        </div>
      </div>

      {blocks.map((block) => (
        <Card key={block.key}>
          <CardHeader title={block.title} description={block.description} />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {block.fields.map(({ def, value }) => (
              <div key={def.key} className={def.type === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""}>
                <FieldInput
                  def={def}
                  value={value}
                  options={options}
                  error={formState.fieldErrors?.[def.key]}
                />
              </div>
            ))}
          </CardBody>
        </Card>
      ))}

      {formState.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-status-reprovado">
          {formState.error}
        </p>
      ) : null}
      {formState.savedCount !== undefined && !formState.error ? (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-status-aprovado">
          {formState.savedCount === 0
            ? "Nada mudou — nenhum registro novo no histórico."
            : `${formState.savedCount} campo(s) alterado(s) e registrado(s) no histórico.`}
        </p>
      ) : null}

      <div>
        <SubmitButton>Salvar etapa</SubmitButton>
      </div>
    </form>
  );
}

function StageStateChip({ state }: { state: "pendente" | "em_andamento" | "concluida" }) {
  const styles = {
    pendente: "bg-surface-muted text-ink-muted",
    em_andamento: "bg-amber-50 text-status-aguardando",
    concluida: "bg-green-50 text-status-aprovado",
  } as const;
  const labels = {
    pendente: "Pendente",
    em_andamento: "Em andamento",
    concluida: "Concluída",
  } as const;

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[state]}`}>
      {labels[state]}
    </span>
  );
}
