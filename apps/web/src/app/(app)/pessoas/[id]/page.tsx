import Link from "next/link";
import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import {
  MARITAL_STATUS_LABELS,
  MODALITY_LABELS,
  NotFoundError,
  formatBRL,
  formatCpf,
  formatPhone,
  resolveCurrentStep,
  stepsForModality,
} from "@corr/core";
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
import { cn } from "@/lib/utils";
import { PersonForm } from "../person-form";
import { IncomeSection } from "./income-section";
import {
  RiskAssessmentDetails,
  RiskExtrasList,
  RiskResultBadge,
} from "@/components/risk/risk-assessment";

export const metadata: Metadata = { title: "Pessoa" };

type Tab = "resumo" | "dados" | "rendas" | "risco";

const TABS: { key: Tab; label: string }[] = [
  { key: "resumo", label: "Resumo" },
  { key: "dados", label: "Dados cadastrais" },
  { key: "rendas", label: "Rendas" },
  { key: "risco", label: "Avaliações de risco" },
];

const DATE = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

function formatDate(value: string | null | undefined): string | null {
  return value ? DATE.format(new Date(`${value}T00:00:00Z`)) : null;
}

/**
 * Cadastro do cliente em abas.
 *
 * Antes era tudo numa página só — processos, avaliações, rendas e mais de
 * quarenta campos —, e o que o operador mais procura (em que processo a pessoa
 * está, se o SICAQ aprovou, quanto ela ganha) ficava enterrado. O resumo
 * responde isso de cara; o formulário completo fica numa aba própria.
 */
export default async function PessoaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const { aba } = await searchParams;
  const tab: Tab = TABS.find((t) => t.key === aba)?.key ?? "resumo";

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

  // A avaliação que importa para o financiamento é a de habitação; CROT e
  // cartão são extras e ficam à parte.
  const housingRisks = riskAssessments.filter((a) => a.housing);
  const extraRisks = riskAssessments.filter((a) => !a.housing);
  const latestRisk = housingRisks[0];
  const counts: Partial<Record<Tab, number>> = {
    rendas: incomes.length,
    risco: riskAssessments.length,
  };

  const facts: [string, string | null][] = [
    ["CPF", formatCpf(person.cpf)],
    ["Nascimento", formatDate(person.birthDate)],
    ["Estado civil", person.maritalStatus ? MARITAL_STATUS_LABELS[person.maritalStatus] : null],
    ["Cônjuge", person.spouseName],
    ["Telefone", person.phone ? formatPhone(person.phone) : null],
    ["E-mail", person.email],
    ["Cidade", person.city ? `${person.city}${person.uf ? `/${person.uf}` : ""}` : null],
    [
      "Agência de relacionamento",
      person.relationshipAgencyNumber
        ? `${person.relationshipAgencyNumber}${person.relationshipAgencyCity ? ` — ${person.relationshipAgencyCity}` : ""}`
        : null,
    ],
  ];

  return (
    <>
      <PageHeader
        title={person.fullName}
        description={formatCpf(person.cpf)}
        action={
          <Link
            href={`/processos/novo?personId=${person.id}`}
            className="inline-flex h-9 items-center rounded-md border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-surface-muted"
          >
            Novo processo
          </Link>
        }
      />

      <main className="flex max-w-5xl flex-col gap-6 p-6">
        <nav aria-label="Seções da pessoa" className="flex flex-wrap gap-1 border-b border-line pb-2">
          {TABS.map((target) => (
            <Link
              key={target.key}
              href={`/pessoas/${id}?aba=${target.key}` as Route}
              aria-current={tab === target.key ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition",
                tab === target.key
                  ? "bg-brand-50 font-medium text-brand-700"
                  : "text-ink-muted hover:bg-surface-muted hover:text-ink",
              )}
            >
              {target.label}
              {counts[target.key] ? (
                <span className="ml-1.5 rounded-full bg-surface-muted px-1.5 text-xs text-ink-muted">
                  {counts[target.key]}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        {tab === "resumo" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardBody>
                  <p className="text-xs text-ink-muted">Renda bruta somada</p>
                  <p className="tabular mt-1 text-lg font-semibold text-ink">{formatBRL(grossTotal)}</p>
                  <p className="text-xs text-ink-muted">{incomes.length} fonte(s)</p>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <p className="text-xs text-ink-muted">Avaliação de risco (habitação)</p>
                  <div className="mt-1.5">
                    {latestRisk ? (
                      <RiskResultBadge result={latestRisk.result} validUntil={latestRisk.validUntil} />
                    ) : (
                      <span className="text-sm text-ink-muted">
                        {extraRisks.length > 0 ? "Só extras capturadas" : "Nenhuma capturada"}
                      </span>
                    )}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <p className="text-xs text-ink-muted">Processos</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{processes.length}</p>
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardHeader
                title="Processos"
                description={
                  processes.length === 0
                    ? "Esta pessoa ainda não participa de nenhum processo."
                    : undefined
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
                            {
                              resolveCurrentStep(
                                stepsForModality(process.modality),
                                process.stepKey,
                                process.stage,
                              ).label
                            }{" "}
                            · {process.bankShortName ?? "Sem banco"} ·{" "}
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
                title="Dados principais"
                action={
                  <Link
                    href={`/pessoas/${id}?aba=dados` as Route}
                    className="text-sm font-medium text-brand-600 hover:underline"
                  >
                    Editar cadastro
                  </Link>
                }
              />
              <CardBody>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                  {facts.map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-xs text-ink-muted">{label}</dt>
                      <dd className={cn("truncate text-sm", value ? "text-ink" : "text-ink-muted")}>
                        {value ?? "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          </>
        ) : tab === "dados" ? (
          <PersonForm person={person} />
        ) : tab === "rendas" ? (
          <IncomeSection personId={person.id} incomes={incomes} grossTotal={grossTotal} />
        ) : (
          <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              title="Avaliações de risco de habitação"
              description={
                housingRisks.length === 0
                  ? "Nenhuma capturada. Abra \"Formulários Enviados\" no Caixa Aqui com este CPF e a extensão traz para cá."
                  : "Lidas da tela \"Formulários Enviados\" do Caixa Aqui. A vigente é a que entra no processo."
              }
            />
            {housingRisks.length > 0 ? (
              <CardBody className="p-0">
                <ul className="divide-y divide-line">
                  {housingRisks.map((assessment) => (
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
          {extraRisks.length > 0 ? (
            <Card>
              <CardHeader
                title="Extras"
                description="CROT, cartão e outros produtos. Ficam aqui para consulta e não entram no processo."
              />
              <CardBody>
                <RiskExtrasList assessments={extraRisks} />
              </CardBody>
            </Card>
          ) : null}
          </div>
        )}
      </main>
    </>
  );
}
