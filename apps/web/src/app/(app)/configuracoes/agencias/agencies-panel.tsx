"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Pencil, Plus } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { saveAgency, removeAgency, type AgencyFormState } from "./actions";

export interface AgencyRow {
  id: string;
  bankId: string;
  bankShortName: string;
  number: string;
  name: string;
  city: string | null;
  uf: string | null;
  email: string | null;
  phone: string | null;
  processCount: number;
}

type BankOption = { value: string; label: string };

function AgencyForm({
  agency,
  banks,
  defaultBankId,
  onDone,
}: {
  agency?: AgencyRow;
  banks: BankOption[];
  defaultBankId: string;
  onDone: () => void;
}) {
  const action = saveAgency.bind(null, agency?.id ?? null);
  const [state, formAction] = useActionState<AgencyFormState, FormData>(action, {});

  useEffect(() => {
    if (state.saved) onDone();
  }, [state, onDone]);

  // Cadastrada só pelo número no processo: o nome provisório vem vazio para
  // o operador completar.
  const nomeAtual = agency && agency.name !== `Agência ${agency.number}` ? agency.name : "";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-6">
        {banks.length > 1 ? (
          <div className="sm:col-span-2">
            <SelectField
              label="Banco"
              name="bankId"
              options={banks}
              placeholder={null}
              defaultValue={agency?.bankId ?? defaultBankId}
            />
          </div>
        ) : (
          <input type="hidden" name="bankId" value={agency?.bankId ?? defaultBankId} />
        )}
        <div className="sm:col-span-2">
          <Field
            label="Número"
            name="number"
            defaultValue={agency?.number ?? ""}
            inputMode="numeric"
            placeholder="1234"
            required
          />
        </div>
        <div className={banks.length > 1 ? "sm:col-span-2" : "sm:col-span-4"}>
          <Field label="Nome" name="name" defaultValue={nomeAtual} placeholder="Ex.: Centro" required />
        </div>
        <div className="sm:col-span-4">
          <Field label="Cidade" name="city" defaultValue={agency?.city ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <Field label="UF" name="uf" defaultValue={agency?.uf ?? ""} maxLength={2} placeholder="SC" />
        </div>
        <div className="sm:col-span-3">
          <Field label="E-mail" name="email" type="email" defaultValue={agency?.email ?? ""} />
        </div>
        <div className="sm:col-span-3">
          <Field label="Telefone" name="phone" defaultValue={agency?.phone ?? ""} />
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-status-reprovado">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <SubmitButton>{agency ? "Salvar agência" : "Cadastrar agência"}</SubmitButton>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function AgenciesPanel({
  agencies,
  banks,
  defaultBankId,
}: {
  agencies: AgencyRow[];
  banks: BankOption[];
  defaultBankId: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const fechar = () => setEditing(null);
  const mostrarBanco = new Set(agencies.map((a) => a.bankId)).size > 1;

  return (
    <Card>
      <CardHeader
        title="Agências do escritório"
        description="Agência digitada pelo número num processo também entra aqui; complete o nome e a cidade dela."
        action={
          editing === "nova" ? null : (
            <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={() => setEditing("nova")}>
              <Plus className="size-4" aria-hidden />
              Nova agência
            </Button>
          )
        }
      />

      {editing === "nova" ? (
        <CardBody className="border-b border-line">
          <AgencyForm banks={banks} defaultBankId={defaultBankId} onDone={fechar} />
        </CardBody>
      ) : null}

      {agencies.length === 0 ? (
        <CardBody>
          <p className="text-sm text-ink-muted">Nenhuma agência cadastrada ainda.</p>
        </CardBody>
      ) : (
        <ul className="divide-y divide-line">
          {agencies.map((agency) => {
            const semNome = agency.name === `Agência ${agency.number}`;
            return (
              <li key={agency.id} className="px-5 py-3">
                {editing === agency.id ? (
                  <AgencyForm agency={agency} banks={banks} defaultBankId={defaultBankId} onDone={fechar} />
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        <span className="tabular">{agency.number}</span>
                        {semNome ? (
                          <span className="ml-2 font-normal text-ink-muted">sem nome</span>
                        ) : (
                          <> — {agency.name}</>
                        )}
                        {mostrarBanco ? (
                          <span className="ml-2 text-xs font-normal text-ink-muted">{agency.bankShortName}</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {[
                          [agency.city, agency.uf].filter(Boolean).join("/"),
                          agency.phone,
                          agency.email,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Sem cidade nem contato"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {agency.processCount > 0 ? (
                        <Link
                          href={`/processos?agencia=${agency.id}&encerrados=1` as Route}
                          className="px-2 text-sm text-brand-600 hover:underline"
                        >
                          {agency.processCount === 1 ? "1 processo" : `${agency.processCount} processos`}
                        </Link>
                      ) : null}
                      <Button variant="ghost" size="sm" className="h-9" onClick={() => setEditing(agency.id)}>
                        <Pencil className="size-4" aria-hidden />
                        Editar
                      </Button>
                      <ConfirmDelete
                        title={`Excluir a agência ${agency.number}?`}
                        submitLabel="Excluir agência"
                        blockedReason={
                          agency.processCount > 0
                            ? `${agency.processCount === 1 ? "Um processo usa" : `${agency.processCount} processos usam`} esta agência. Troque a agência ${agency.processCount === 1 ? "dele" : "deles"} antes de excluir.`
                            : undefined
                        }
                        onConfirm={() => removeAgency(agency.id)}
                      >
                        A agência sai do cadastro do escritório.
                      </ConfirmDelete>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
