"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  INCOME_KIND_LABELS,
  INCOME_PROOF_TYPE_LABELS,
  formatBRL,
  type IncomeKind,
} from "@corr/core";
import type { PersonIncome } from "@corr/db";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField, optionsFromLabels } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { addIncome, removeIncome } from "../actions";

export function IncomeSection({
  personId,
  incomes,
  grossTotal,
}: {
  personId: string;
  incomes: PersonIncome[];
  grossTotal: number;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<IncomeKind>("formal");
  const action = addIncome.bind(null, personId);
  const [state, formAction] = useActionState<{ error?: string }, FormData>(action, {});

  return (
    <Card>
      <CardHeader
        title="Rendas"
        description={
          incomes.length === 0
            ? "Nenhuma renda cadastrada."
            : `${incomes.length} fonte(s) · renda bruta somada: ${formatBRL(grossTotal)}`
        }
        action={
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Cancelar" : "Adicionar renda"}
          </Button>
        }
      />

      {incomes.length > 0 ? (
        <CardBody className="p-0">
          <ul className="divide-y divide-line">
            {incomes.map((income) => (
              <li key={income.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {income.sourceName ?? INCOME_KIND_LABELS[income.kind]}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {INCOME_KIND_LABELS[income.kind]}
                    {income.proofType ? ` · ${INCOME_PROOF_TYPE_LABELS[income.proofType]}` : ""}
                    {income.proofMonth && income.proofYear
                      ? ` · ${String(income.proofMonth).padStart(2, "0")}/${income.proofYear}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="tabular text-sm font-medium text-ink">
                    {formatBRL(income.grossCents)}
                  </span>
                  <form action={removeIncome.bind(null, personId, income.id)}>
                    <button
                      type="submit"
                      aria-label={`Remover renda ${income.sourceName ?? ""}`}
                      className="rounded-md p-1.5 text-ink-muted hover:bg-surface-muted hover:text-status-reprovado"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      ) : null}

      {open ? (
        <CardBody className="border-t border-line bg-surface-muted/40">
          <form action={formAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField
              label="Tipo"
              name="kind"
              placeholder={null}
              options={optionsFromLabels(INCOME_KIND_LABELS)}
              value={kind}
              onChange={(event) => setKind(event.target.value as IncomeKind)}
            />
            <Field
              label={kind === "formal" ? "Fonte pagadora" : "Atividade"}
              name="sourceName"
              required
            />
            <Field
              label={kind === "formal" ? "CNPJ/CPF da fonte" : "Documento"}
              name="sourceDocument"
              inputMode="numeric"
            />
            <Field label="Renda bruta" name="grossCents" placeholder="0,00" inputMode="decimal" />
            <Field label="Renda líquida" name="netCents" placeholder="0,00" inputMode="decimal" />
            <Field
              label={kind === "formal" ? "Data de admissão" : "Data de início"}
              name="startDate"
              type="date"
            />
            <SelectField
              label="Comprovante"
              name="proofType"
              options={optionsFromLabels(INCOME_PROOF_TYPE_LABELS)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Competência (mês)" name="proofMonth" inputMode="numeric" maxLength={2} />
              <Field label="Ano" name="proofYear" inputMode="numeric" maxLength={4} />
            </div>

            {state.error ? (
              <p role="alert" className="text-sm text-status-reprovado sm:col-span-2 lg:col-span-3">
                {state.error}
              </p>
            ) : null}

            <div className="sm:col-span-2 lg:col-span-3">
              <SubmitButton size="sm">Adicionar renda</SubmitButton>
            </div>
          </form>
        </CardBody>
      ) : null}
    </Card>
  );
}
