"use client";

import { useActionState, useTransition, type ReactNode } from "react";
import type { FieldOption, FieldView } from "@corr/core";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldInput, type DynamicOptions } from "@/components/fields/field-input";
import { assignStageAction, saveStageFields, type StageFormState } from "./stage-actions";

export type StepState = "concluida" | "atual" | "pendente";

export interface RenderBlock {
  key: string;
  title: string;
  description?: string;
  fields: { def: FieldView; value: string | number | null }[];
}

/**
 * Tela de uma etapa: quem é o responsável, os botões de movimento e os campos.
 *
 * `fieldsKey` é a tela de campos do fluxo do escritório que vale para a etapa
 * — várias etapas seguidas (SICAQ, vistoria, PEPT) preenchem a mesma análise
 * de crédito, então a configuração de campos não se repete etapa a etapa.
 */
export function StageForm({
  processId,
  stepKey,
  fieldsKey,
  stepLabel,
  subtitle,
  blocks,
  options,
  state: stepState,
  assignedTo,
  members,
  actions,
}: {
  processId: string;
  stepKey: string;
  fieldsKey: string;
  stepLabel: string;
  subtitle: string;
  blocks: RenderBlock[];
  options: DynamicOptions;
  state: StepState;
  assignedTo: string | null;
  members: FieldOption[];
  actions: ReactNode;
}) {
  const action = saveStageFields.bind(null, processId, fieldsKey);
  const [formState, formAction] = useActionState<StageFormState, FormData>(action, {});
  const [pending, startTransition] = useTransition();

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-ink">{stepLabel}</h2>
            <StepStateChip state={stepState} />
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Responsável pela etapa"
            className="h-8 w-44 text-xs"
            options={members}
            defaultValue={assignedTo ?? ""}
            disabled={pending}
            onChange={(event) =>
              startTransition(() => void assignStageAction(processId, stepKey, event.target.value))
            }
          />
          {actions}
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

function StepStateChip({ state }: { state: StepState }) {
  const styles = {
    pendente: "bg-surface-muted text-ink-muted",
    atual: "bg-amber-50 text-status-aguardando",
    concluida: "bg-green-50 text-status-aprovado",
  } as const;
  const labels = {
    pendente: "Pendente",
    atual: "Etapa atual",
    concluida: "Concluída",
  } as const;

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[state]}`}>
      {labels[state]}
    </span>
  );
}
