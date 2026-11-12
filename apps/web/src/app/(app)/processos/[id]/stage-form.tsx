"use client";

import { useActionState } from "react";
import type { FieldView } from "@corr/core";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldInput, type DynamicOptions } from "@/components/fields/field-input";
import type { AgenciaOpcao } from "@/lib/agencias";
import { saveStageFields, type StageFormState } from "./stage-actions";

export type StepState = "concluida" | "atual" | "pendente";

export interface RenderBlock {
  key: string;
  title: string;
  description?: string;
  fields: { def: FieldView; value: string | number | null }[];
}

/**
 * Campos de uma etapa. Cada etapa mostra só o que se preenche nela; a visão
 * completa do processo é o PDF "Resumo do processo".
 *
 * `fieldsKey` é a fase do fluxo do escritório, usada quando a etapa não tem
 * campos próprios.
 */
export function StageForm({
  processId,
  stepKey,
  fieldsKey,
  blocks,
  options,
  agencias,
}: {
  processId: string;
  stepKey: string;
  fieldsKey: string;
  blocks: RenderBlock[];
  options: DynamicOptions;
  agencias: AgenciaOpcao[];
}) {
  const action = saveStageFields.bind(null, processId, fieldsKey, stepKey);
  const [formState, formAction] = useActionState<StageFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {blocks.map((block) => (
        <Card key={block.key}>
          <CardHeader title={block.title} description={block.description} />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {block.fields.map(({ def, value }) => (
              <div
                key={def.key}
                className={def.type === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""}
              >
                <FieldInput
                  def={def}
                  value={value}
                  options={options}
                  agencias={agencias}
                  error={formState.fieldErrors?.[def.key]}
                />
              </div>
            ))}
          </CardBody>
        </Card>
      ))}

      {/*
        Barra de salvar presa ao rodapé: com três ou quatro blocos de campos,
        o botão sumia da tela e o operador rolava até o fim só para salvar.
      */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-line bg-surface/95 py-3 backdrop-blur">
        <SubmitButton>Salvar dados</SubmitButton>
        {formState.error ? (
          <p
            role="alert"
            className="rounded-md bg-red-50 px-3 py-1.5 text-sm text-status-reprovado"
          >
            {formState.error}
          </p>
        ) : formState.savedCount !== undefined ? (
          <p
            role="status"
            className="rounded-md bg-green-50 px-3 py-1.5 text-sm text-status-aprovado"
          >
            {formState.savedCount === 0
              ? "Nada mudou — nenhum registro novo no histórico."
              : `${formState.savedCount} campo(s) alterado(s) e registrado(s) no histórico.`}
          </p>
        ) : null}
      </div>
    </form>
  );
}
