import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import {
  PROCESS_STATUS_LABELS,
  PROCESS_STATUS_TOKENS,
  formatBRL,
  type ProcessStatus,
} from "@corr/core";
import { listExpiringProcesses, summarizeProcesses } from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

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
  const [summary, expiring] = await Promise.all([
    summarizeProcesses(ctx),
    listExpiringProcesses(ctx, 30),
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

        <Card>
          <CardHeader
            title="Próximos passos"
            description="O que ainda falta construir nesta tela."
          />
          <CardBody className="text-sm text-ink-muted">
            Os gráficos por banco e por modalidade, o filtro por período (criação, aprovação,
            assinatura) e o resumo diário entram junto com a auditoria campo-a-campo, na etapa M2.
          </CardBody>
        </Card>
      </main>
    </>
  );
}
