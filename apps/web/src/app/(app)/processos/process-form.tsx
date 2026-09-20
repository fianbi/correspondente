"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  AMORTIZATION_SYSTEM_LABELS,
  MODALITY_LABELS,
  PROCESS_STAGE_LABELS,
  PROCESS_STATUS_LABELS,
  formatCpf,
} from "@corr/core";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SelectField, optionsFromLabels, type SelectOption } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { createProcessAction, type ProcessFormState } from "./actions";

export interface ProcessFormOptions {
  people: { id: string; fullName: string; cpf: string }[];
  banks: { id: string; shortName: string }[];
  agencies: { id: string; name: string; number: string; bankShortName: string }[];
  brokers: { id: string; name: string }[];
  realEstateAgencies: { id: string; name: string }[];
  members: { userId: string; fullName: string }[];
}

/**
 * Formulário de abertura de processo. Só o essencial para o registro existir —
 * o resto é preenchido etapa por etapa na tela do processo, que é onde cada
 * alteração vira histórico.
 */
export function ProcessForm({
  options,
  defaultPersonId,
}: {
  options: ProcessFormOptions;
  defaultPersonId?: string;
}) {
  const [state, formAction] = useActionState<ProcessFormState, FormData>(
    createProcessAction,
    {},
  );
  const errorOf = (field: string) => state.fieldErrors?.[field];

  const peopleOptions: SelectOption[] = options.people.map((person) => ({
    value: person.id,
    label: `${person.fullName} — ${formatCpf(person.cpf)}`,
  }));

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Proponente e situação" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <SelectField
              label="Proponente principal"
              name="personId"
              placeholder="Selecione a pessoa"
              options={peopleOptions}
              defaultValue={defaultPersonId ?? ""}
              error={errorOf("personId")}
              hint="Outras pessoas (cônjuge, vendedor) entram depois, no processo."
            />
          </div>
          <SelectField
            label="Fase"
            name="stage"
            placeholder={null}
            options={optionsFromLabels(PROCESS_STAGE_LABELS)}
            defaultValue="cadastro"
          />
          <SelectField
            label="Status"
            name="status"
            placeholder={null}
            options={optionsFromLabels(PROCESS_STATUS_LABELS)}
            defaultValue="em_aberto"
          />
          <SelectField
            label="Responsável"
            name="assignedTo"
            options={options.members.map((m) => ({ value: m.userId, label: m.fullName }))}
            defaultValue={""}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Proposta" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField
            label="Banco"
            name="bankId"
            options={options.banks.map((bank) => ({ value: bank.id, label: bank.shortName }))}
            defaultValue={""}
          />
          <SelectField
            label="Agência"
            name="agencyId"
            options={options.agencies.map((agency) => ({
              value: agency.id,
              label: `${agency.number} — ${agency.name}`,
            }))}
            defaultValue={""}
            hint={options.agencies.length === 0 ? "Nenhuma agência cadastrada ainda." : undefined}
          />
          <SelectField
            label="Modalidade"
            name="modality"
            options={optionsFromLabels(MODALITY_LABELS)}
            defaultValue={""}
          />
          <SelectField
            label="Sistema de amortização"
            name="amortizationSystem"
            options={optionsFromLabels(AMORTIZATION_SYSTEM_LABELS)}
            defaultValue={""}
          />
          <Field label="Indexador" name="indexer" defaultValue={""} placeholder="TR, IPCA…" />
          <Field label="Prazo (meses)" name="termMonths" inputMode="numeric" defaultValue={""} />
          <Field label="Número da proposta" name="proposalNumber" defaultValue={""} />
          <Field label="Número do contrato" name="contractNumber" defaultValue={""} />
          <Field
            label="Validade do crédito"
            name="creditValidUntil"
            type="date"
            defaultValue={""}
            hint="Alimenta o alerta de processos a vencer."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Valores" description="Digite como preferir: 350000, 350.000,00 ou R$ 350.000,00." />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Valor do imóvel"
            name="propertyValueCents"
            inputMode="decimal"
            defaultValue={""}
          />
          <Field
            label="Valor de financiamento"
            name="financedValueCents"
            inputMode="decimal"
            defaultValue={""}
          />
          <Field
            label="Valor aprovado"
            name="approvedValueCents"
            inputMode="decimal"
            defaultValue={""}
          />
          <Field
            label="Subsídio"
            name="subsidyCents"
            inputMode="decimal"
            defaultValue={""}
          />
          <Field
            label="FGTS"
            name="fgtsCents"
            inputMode="decimal"
            defaultValue={""}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Imóvel e parceiros" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="Endereço do imóvel" name="propertyAddress" defaultValue={""} />
          </div>
          <Field
            label="Matrícula"
            name="propertyRegistration"
            defaultValue={""}
          />
          <SelectField
            label="Imobiliária"
            name="realEstateAgencyId"
            options={options.realEstateAgencies.map((a) => ({ value: a.id, label: a.name }))}
            defaultValue={""}
          />
          <SelectField
            label="Corretor"
            name="brokerId"
            options={options.brokers.map((b) => ({ value: b.id, label: b.name }))}
            defaultValue={""}
          />
        </CardBody>
      </Card>

      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-status-reprovado">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <SubmitButton>Criar processo</SubmitButton>
        <Link
          href="/processos"
          className="inline-flex h-10 items-center rounded-md border border-line bg-white px-4 text-sm font-medium text-ink hover:bg-surface-muted"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
