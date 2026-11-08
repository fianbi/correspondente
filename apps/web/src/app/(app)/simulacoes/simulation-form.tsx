"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AMORTIZATION_SYSTEM_LABELS, toPlainBRL } from "@corr/core";
import type { Simulation } from "@corr/db";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select, SelectField, optionsFromLabels } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveSimulation, type SimulationFormState } from "./actions";

const SIM_NAO = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
];

const AMORTIZATION_OPTIONS = optionsFromLabels(AMORTIZATION_SYSTEM_LABELS);

const simNao = (value: boolean | null | undefined) =>
  value === true ? "sim" : value === false ? "nao" : "";

interface ScenarioRow {
  financed: string;
  term: string;
  amortization: string;
  rate: string;
  installment: string;
  subsidy: string;
}

const EMPTY_ROW: ScenarioRow = {
  financed: "",
  term: "",
  amortization: "",
  rate: "",
  installment: "",
  subsidy: "",
};

const inputClass =
  "h-9 w-full rounded-md border border-line bg-white px-2 text-sm text-ink focus:border-brand-500 focus:outline-2 focus:outline-brand-500/30";

/**
 * Simulação: quem é o cliente (nome e telefone bastam), as sete perguntas e os
 * cenários que o simulador devolveu. O cenário marcado é o que vai para a
 * proposta quando o processo for aberto.
 */
export function SimulationForm({ simulation }: { simulation?: Simulation }) {
  const action = saveSimulation.bind(null, simulation?.id ?? null);
  const [state, formAction] = useActionState<SimulationFormState, FormData>(action, {});
  const errorOf = (field: string) => state.fieldErrors?.[field];

  const [rows, setRows] = useState<ScenarioRow[]>(
    simulation && simulation.scenarios.length > 0
      ? simulation.scenarios.map((s) => ({
          financed: toPlainBRL(s.financedValueCents),
          term: s.termMonths?.toString() ?? "",
          amortization: s.amortization ?? "",
          rate: s.interestRate ?? "",
          installment: toPlainBRL(s.firstInstallmentCents),
          subsidy: toPlainBRL(s.subsidyCents),
        }))
      : [EMPTY_ROW],
  );
  const [chosen, setChosen] = useState<number>(
    Math.max(0, simulation?.scenarios.findIndex((s) => s.chosen) ?? 0),
  );

  const setCell = (index: number, key: keyof ScenarioRow, value: string) =>
    setRows(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Cliente" description="Ainda sem CPF: nome e telefone bastam para simular." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nome do cliente"
            name="clientName"
            required
            defaultValue={simulation?.clientName ?? ""}
            error={errorOf("clientName")}
          />
          <Field
            label="Telefone"
            name="clientPhone"
            placeholder="(00) 00000-0000"
            defaultValue={simulation?.clientPhone ?? ""}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Questionário" description="Digite valores como preferir: 350000, 350.000,00 ou R$ 350.000,00." />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Data de nascimento (proponente mais velho)"
            name="oldestBirthDate"
            type="date"
            defaultValue={simulation?.oldestBirthDate ?? ""}
            hint="Idade + prazo não pode passar de 80 anos e 6 meses."
          />
          <Field
            label="Renda bruta mensal (soma dos proponentes)"
            name="familyIncomeCents"
            inputMode="decimal"
            defaultValue={toPlainBRL(simulation?.familyIncomeCents)}
            error={errorOf("familyIncomeCents")}
          />
          <SelectField
            label="3 anos de registro (FGTS)"
            name="fgtsThreeYears"
            options={SIM_NAO}
            defaultValue={simNao(simulation?.fgtsThreeYears)}
          />
          <SelectField
            label="Mais de um comprador, cônjuge ou dependente"
            name="multipleBuyers"
            options={SIM_NAO}
            defaultValue={simNao(simulation?.multipleBuyers)}
          />
          <Field
            label="Valor do imóvel"
            name="propertyValueCents"
            inputMode="decimal"
            defaultValue={toPlainBRL(simulation?.propertyValueCents)}
            error={errorOf("propertyValueCents")}
          />
          <SelectField
            label="Já recebeu subsídio"
            name="hadSubsidy"
            options={SIM_NAO}
            defaultValue={simNao(simulation?.hadSubsidy)}
          />
          <SelectField
            label="Já tem imóvel"
            name="ownsProperty"
            options={SIM_NAO}
            defaultValue={simNao(simulation?.ownsProperty)}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Cenários simulados"
          description="O resultado de cada simulação feita. Marque o que o cliente escolheu."
          action={
            <Button type="button" variant="secondary" size="sm" onClick={() => setRows([...rows, EMPTY_ROW])}>
              <Plus className="size-4" aria-hidden />
              Adicionar cenário
            </Button>
          }
        />
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-3xl text-sm">
            <thead className="border-b border-line bg-surface-muted text-left text-xs text-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Escolhido</th>
                <th className="px-3 py-2 font-medium">Valor financiado</th>
                <th className="px-3 py-2 font-medium">Prazo (meses)</th>
                <th className="px-3 py-2 font-medium">Amortização</th>
                <th className="px-3 py-2 font-medium">Taxa (% a.a.)</th>
                <th className="px-3 py-2 font-medium">1ª parcela</th>
                <th className="px-3 py-2 font-medium">Subsídio</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, index) => (
                <tr key={index}>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="radio"
                      name="scenarioChosen"
                      value={index}
                      checked={chosen === index}
                      onChange={() => setChosen(index)}
                      aria-label={`Cenário ${index + 1} escolhido`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputClass}
                      name="scenarioFinanced"
                      inputMode="decimal"
                      aria-label={`Valor financiado do cenário ${index + 1}`}
                      value={row.financed}
                      onChange={(event) => setCell(index, "financed", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputClass}
                      name="scenarioTerm"
                      inputMode="numeric"
                      aria-label={`Prazo do cenário ${index + 1}`}
                      value={row.term}
                      onChange={(event) => setCell(index, "term", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      className="h-9"
                      name="scenarioAmortization"
                      aria-label={`Amortização do cenário ${index + 1}`}
                      options={AMORTIZATION_OPTIONS}
                      value={row.amortization}
                      onChange={(event) => setCell(index, "amortization", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputClass}
                      name="scenarioRate"
                      placeholder="8,16"
                      aria-label={`Taxa do cenário ${index + 1}`}
                      value={row.rate}
                      onChange={(event) => setCell(index, "rate", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputClass}
                      name="scenarioInstallment"
                      inputMode="decimal"
                      aria-label={`Primeira parcela do cenário ${index + 1}`}
                      value={row.installment}
                      onChange={(event) => setCell(index, "installment", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputClass}
                      name="scenarioSubsidy"
                      inputMode="decimal"
                      aria-label={`Subsídio do cenário ${index + 1}`}
                      value={row.subsidy}
                      onChange={(event) => setCell(index, "subsidy", event.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {rows.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Remover cenário ${index + 1}`}
                        onClick={() => {
                          setRows(rows.filter((_, i) => i !== index));
                          setChosen(chosen > index ? chosen - 1 : chosen === index ? 0 : chosen);
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Observações" />
        <CardBody>
          <textarea
            name="notes"
            rows={3}
            aria-label="Observações"
            defaultValue={simulation?.notes ?? ""}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-2 focus:outline-brand-500/30"
          />
        </CardBody>
      </Card>

      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-status-reprovado">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-status-aprovado">
          Simulação salva.
        </p>
      ) : null}

      <div className="flex gap-2">
        <SubmitButton>{simulation ? "Salvar simulação" : "Criar simulação"}</SubmitButton>
        <Link
          href="/simulacoes"
          className="inline-flex h-10 items-center rounded-md border border-line bg-white px-4 text-sm font-medium text-ink hover:bg-surface-muted"
        >
          Voltar
        </Link>
      </div>
    </form>
  );
}
