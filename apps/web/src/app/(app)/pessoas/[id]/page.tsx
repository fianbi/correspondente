import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotFoundError, formatBRL, formatCpf, MODALITY_LABELS } from "@corr/core";
import {
  getPerson,
  listPersonIncomes,
  listProcessesForPerson,
  listRiskAssessmentsForPeople,
  sumPersonGrossIncome,
} from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { PersonForm } from "../person-form";
import { IncomeSection } from "./income-section";
import { RiskAssessmentDetails, RiskResultBadge } from "@/components/risk/risk-assessment";

export const metadata: Metadata = { title: "Pessoa" };

export default async function PessoaPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext();
  const { id } = await params;

  const person = await getPerson(ctx, id).catch((error: unknown) => {
    // Pessoa de outro escritório chega aqui como "não encontrada" — a RLS já
    // barrou a linha antes de qualquer verificação na aplicação.
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const [incomes, processes, grossTotal, riskAssessments] = await Promise.all([
    listPersonIncomes(ctx, id),
    listProcessesForPerson(ctx, id),
    sumPersonGrossIncome(ctx, id),
    listRiskAssessmentsForPeople(ctx, [id]),
  ]);

  return (
    <>
      <PageHeader title={person.fullName} description={formatCpf(person.cpf)} />

      <main className="flex max-w-5xl flex-col gap-6 p-6">
        <Card>
          <CardHeader
            title="Processos"
            description={
              processes.length === 0
                ? "Esta pessoa ainda não participa de nenhum processo."
                : `${processes.length} processo(s).`
            }
            action={
              <Link
                href={`/processos/novo?personId=${person.id}`}
                className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-surface-muted"
              >
                Novo processo
              </Link>
            }
          />
          {processes.length > 0 ? (
            <CardBody className="p-0">
              <ul className="divide-y divide-line">
                {processes.map((process) => (
                  <li key={process.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/processos/${process.id}`}
                        className="text-sm font-medium text-ink hover:text-brand-600 hover:underline"
                      >
                        #{process.number}{" "}
                        {process.modality ? MODALITY_LABELS[process.modality] : "Sem modalidade"}
                      </Link>
                      <p className="text-xs text-ink-muted">
                        {process.bankShortName ?? "Sem banco"} ·{" "}
                        {formatBRL(process.financedValueCents)}
                      </p>
                    </div>
                    <StatusBadge status={process.status} />
                  </li>
                ))}
              </ul>
            </CardBody>
          ) : null}
        </Card>

        <Card>
          <CardHeader
            title="Avaliações de risco"
            description={
              riskAssessments.length === 0
                ? "Nenhuma capturada. Abra \"Formulários Enviados\" no Caixa Aqui com este CPF e a extensão traz para cá."
                : "Lidas da tela \"Formulários Enviados\" do Caixa Aqui."
            }
          />
          {riskAssessments.length > 0 ? (
            <CardBody className="p-0">
              <ul className="divide-y divide-line">
                {riskAssessments.map((assessment) => (
                  <li key={assessment.id} className="flex flex-col gap-3 px-5 py-4">
                    <div>
                      <RiskResultBadge result={assessment.result} validUntil={assessment.validUntil} />
                    </div>
                    <RiskAssessmentDetails assessment={assessment} />
                  </li>
                ))}
              </ul>
            </CardBody>
          ) : null}
        </Card>

        <IncomeSection personId={person.id} incomes={incomes} grossTotal={grossTotal} />

        <PersonForm person={person} />
      </main>
    </>
  );
}
