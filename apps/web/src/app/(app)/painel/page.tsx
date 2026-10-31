import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import {
  MODALITY_LABELS,
  PROCESS_STATUS_LABELS,
  PROCESS_STATUS_TOKENS,
  formatBRL,
  type Modality,
  type ProcessStatus,
} from "@corr/core";
import {
  listExpiringProcesses,
  summarizeByBank,
  summarizeByModality,
  summarizeByStep,
  summarizeProcesses,
} from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BarList } from "@/components/charts/bar-list";

export const metadata: Metadata = { title: "Painel" };

/** Status que ganham card no painel, na ordem em que o operador pensa neles. */
const KPI_STATUSES: ProcessStatus[] = [
  "em_aberto",
  "aguardando",
  "aprovado",
  "condicionado",
  "assinado",
  "vencido",
];

const TOKEN_TEXT_CLASSES: Record<string, string> = {
  aberto: "text-status-aberto",
  aguardando: "text-status-aguardando",
  aprovado: "text-status-aprovado",
  condicionado: "text-status-condicionado",
  assinado: "text-status-assinado",
  vencido: "text-status-vencido",
  reprovado: "text-status-reprovado",
};

export default async function PainelPage() {
  const ctx = await requireOrgContext();
  const [summary, expiring, porBanco, porModalidade, porFase] = await Promise.all([
    summarizeProcesses(ctx),
    listExpiringProcesses(ctx, 30),
    summarizeByBank(ctx),
    summarizeByModality(ctx),
    summarizeByStep(ctx),
  ]);

  const byStatus = new Map(summary.map((row) => [row.status, row]));

  return (
    <>
      <PageHeader title="Painel" description={`Visão geral de ${ctx.orgName}.`} />

      <main className="flex flex-col gap-6 p-6">
        {expiring.length > 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-aguardando" aria-hidden />
            <div className="text-sm">
              <p className="font-medium text-ink">
                {expiring.length} processo(s) com crédito vencendo em até 30 dias
              </p>
              <ul className="mt-1 space-y-0.5 text-ink-muted">
                {expiring.slice(0, 4).map((process) => (
                  <li key={process.id}>
                    <Link
                      href={`/processos/${process.id}`}
                      className="underline-offset-2 hover:text-ink hover:underline"
                    >
                      #{process.number} {process.personName}
                    </Link>{" "}
                    — vence em {process.creditValidUntil}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {KPI_STATUSES.map((status) => {
            const row = byStatus.get(status);
            const token = PROCESS_STATUS_TOKENS[status];
            return (
              <Card key={status}>
                <CardBody className="py-3">
                  <p className="text-xs font-medium text-ink-muted">
                    {PROCESS_STATUS_LABELS[status]}
                  </p>
                  <p
                    className={`tabular mt-1 text-lg font-semibold ${TOKEN_TEXT_CLASSES[token] ?? "text-ink"}`}
                  >
                    {formatBRL(row?.totalCents ?? 0)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {row?.quantity ?? 0} processo(s)
                  </p>
                </CardBody>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Onde os processos estão"
              description="Processos ativos por etapa."
            />
            <BarList items={porFase} emptyMessage="Nenhum processo ativo." />
          </Card>

          <Card>
            <CardHeader
              title="Por banco"
              description="Volume financiado em processos ativos."
            />
            <BarList
              measure="value"
              items={porBanco}
              emptyMessage="Nenhum processo com banco definido."
            />
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title="Por modalidade" description="Processos ativos." />
            <BarList
              items={porModalidade.map((linha) => ({
                ...linha,
                label:
                  MODALITY_LABELS[linha.label as Modality] ??
                  (linha.label === "sem_modalidade" ? "Sem modalidade" : linha.label),
              }))}
            />
          </Card>
        </section>
      </main>
    </>
  );
}
