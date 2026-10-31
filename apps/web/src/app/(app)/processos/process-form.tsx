"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  MODALITY_LABELS,
  OTHER_PARTICIPANT_ROLES,
  PARTICIPANT_ROLE_LABELS,
  formatBRL,
  formatCpf,
} from "@corr/core";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select, SelectField, optionsFromLabels, type SelectOption } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { createProcessAction, type ProcessFormState } from "./actions";

export interface ProcessFormOptions {
  people: { id: string; fullName: string; cpf: string; grossIncomeCents: number }[];
  brokers: { id: string; name: string }[];
  realEstateAgencies: { id: string; name: string }[];
}

/** Valor do select que troca a lista por um campo de nome novo. */
const NEW = "__novo__";

const ROLE_OPTIONS: SelectOption[] = OTHER_PARTICIPANT_ROLES.map((role) => ({
  value: role,
  label: PARTICIPANT_ROLE_LABELS[role],
}));

/**
 * Abertura de processo: modalidade e quem participa, nada mais. Banco,
 * valores e imóvel se preenchem depois, etapa por etapa — tela com tudo de uma
 * vez assusta e quase sempre sai incompleta mesmo.
 *
 * A ordem dos proponentes não importa aqui: o servidor põe como principal o
 * de maior renda, que é a regra da Caixa.
 */
export function ProcessForm({
  options,
  defaultPersonId,
}: {
  options: ProcessFormOptions;
  defaultPersonId?: string;
}) {
  const [state, formAction] = useActionState<ProcessFormState, FormData>(createProcessAction, {});
  const errorOf = (field: string) => state.fieldErrors?.[field];

  const [proponents, setProponents] = useState<string[]>([defaultPersonId ?? ""]);
  const [others, setOthers] = useState<{ role: string; personId: string }[]>([]);
  const [broker, setBroker] = useState("");
  const [agency, setAgency] = useState("");

  const peopleOptions: SelectOption[] = options.people.map((person) => ({
    value: person.id,
    label: `${person.fullName} — ${formatCpf(person.cpf)} · renda ${formatBRL(person.grossIncomeCents)}`,
  }));

  const incomeOf = (id: string) => options.people.find((p) => p.id === id)?.grossIncomeCents ?? 0;
  const chosen = proponents.filter(Boolean);
  const principal = chosen.reduce<string | null>(
    (best, id) => (best === null || incomeOf(id) > incomeOf(best) ? id : best),
    null,
  );
  const principalName = options.people.find((p) => p.id === principal)?.fullName;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Modalidade" description="Define as etapas que o processo vai seguir." />
        <CardBody className="max-w-md">
          <SelectField
            label="Modalidade"
            name="modality"
            placeholder="Selecione"
            options={optionsFromLabels(MODALITY_LABELS)}
            defaultValue=""
            error={errorOf("modality")}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Proponentes"
          description="Quem compra ou toma o crédito: um casal, dois ou três compradores."
          action={
            <Link
              href="/pessoas/nova"
              target="_blank"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Cadastrar pessoa
            </Link>
          }
        />
        <CardBody className="flex flex-col gap-3">
          {proponents.map((value, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select
                aria-label={`Proponente ${index + 1}`}
                name="proponentIds"
                placeholder="Selecione a pessoa"
                options={peopleOptions}
                value={value}
                onChange={(event) =>
                  setProponents(proponents.map((v, i) => (i === index ? event.target.value : v)))
                }
              />
              {proponents.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remover proponente ${index + 1}`}
                  onClick={() => setProponents(proponents.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              ) : null}
            </div>
          ))}
          {errorOf("proponentIds") ? (
            <p className="text-sm text-status-reprovado">{errorOf("proponentIds")}</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setProponents([...proponents, ""])}>
              <Plus className="size-4" aria-hidden />
              Adicionar proponente
            </Button>
            {principalName && chosen.length > 1 ? (
              <p className="text-xs text-ink-muted" data-testid="proponente-principal">
                Principal: {principalName} (maior renda)
              </p>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Outros participantes"
          description="Vendedor, engenheiro, cônjuge que não compõe renda. Dá para incluir depois também."
        />
        <CardBody className="flex flex-col gap-3">
          {others.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select
                aria-label={`Papel do participante ${index + 1}`}
                name="participantRole"
                className="w-56 shrink-0"
                placeholder={null}
                options={ROLE_OPTIONS}
                value={row.role}
                onChange={(event) =>
                  setOthers(others.map((r, i) => (i === index ? { ...r, role: event.target.value } : r)))
                }
              />
              <Select
                aria-label={`Participante ${index + 1}`}
                name="participantPersonId"
                placeholder="Selecione a pessoa"
                options={peopleOptions}
                value={row.personId}
                onChange={(event) =>
                  setOthers(others.map((r, i) => (i === index ? { ...r, personId: event.target.value } : r)))
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remover participante ${index + 1}`}
                onClick={() => setOthers(others.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
          {errorOf("participants") ? (
            <p className="text-sm text-status-reprovado">{errorOf("participants")}</p>
          ) : null}
          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setOthers([...others, { role: "vendedor", personId: "" }])}
            >
              <Plus className="size-4" aria-hidden />
              Adicionar participante
            </Button>
          </div>

          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <SelectField
                label="Corretor"
                name="brokerId"
                options={[
                  ...options.brokers.map((b) => ({ value: b.id, label: b.name })),
                  { value: NEW, label: "Cadastrar novo…" },
                ]}
                value={broker}
                onChange={(event) => setBroker(event.target.value)}
              />
              {broker === NEW ? <Field label="Nome do corretor" name="newBrokerName" /> : null}
            </div>
            <div className="flex flex-col gap-2">
              <SelectField
                label="Imobiliária"
                name="realEstateAgencyId"
                options={[
                  ...options.realEstateAgencies.map((a) => ({ value: a.id, label: a.name })),
                  { value: NEW, label: "Cadastrar nova…" },
                ]}
                value={agency}
                onChange={(event) => setAgency(event.target.value)}
              />
              {agency === NEW ? <Field label="Nome da imobiliária" name="newRealEstateAgencyName" /> : null}
            </div>
          </div>
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
