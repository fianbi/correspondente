import Link from "next/link";
import type { Metadata, Route } from "next";
import { Plus } from "lucide-react";
import {
  MODALITY_LABELS,
  PROCESS_STAGE_LABELS,
  formatBRL,
  formatCpf,
} from "@corr/core";
import { listProcesses, listProcessesByStage } from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { PageHeader, EmptyState } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { KanbanBoard } from "./kanban";

export const metadata: Metadata = { title: "Processos" };

type View = "kanban" | "tabela";

export default async function ProcessosPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; encerrados?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { view: rawView, encerrados } = await searchParams;
  const view: View = rawView === "tabela" ? "tabela" : "kanban";
  const includeClosed = encerrados === "1";

  const [columns, rows] = await Promise.all([
    view === "kanban" ? listProcessesByStage(ctx, { includeClosed }) : Promise.resolve([]),
    view === "tabela" ? listProcesses(ctx, { includeClosed }) : Promise.resolve([]),
  ]);

  const isEmpty = view === "kanban" ? columns.every((c) => c.processes.length === 0) : rows.length === 0;

  // `typedRoutes` valida rotas literais; estas são montadas em tempo de
  // execução a partir de valores que já vieram validados acima.
  const viewHref = (target: View) =>
    `/processos?view=${target}${includeClosed ? "&encerrados=1" : ""}` as Route;

  return (
    <>
      <PageHeader
        title="Processos"
        description="A esteira do escritório, da montagem do cadastro ao registro em cartório."
        action={
          <Link
            href="/processos/novo"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Plus className="size-4" aria-hidden />
            Novo processo
          </Link>
        }
      />

      <main className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <nav className="inline-flex rounded-md border border-line bg-white p-0.5" aria-label="Modo de visualização">
            {(["kanban", "tabela"] as const).map((target) => (
              <Link
                key={target}
                href={viewHref(target)}
                aria-current={view === target ? "page" : undefined}
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium capitalize transition",
                  view === target ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:text-ink",
                )}
              >
                {target}
              </Link>
            ))}
          </nav>

          <Link
            href={`/processos?view=${view}${includeClosed ? "" : "&encerrados=1"}` as Route}
            className="text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            {includeClosed ? "Ocultar encerrados" : "Mostrar encerrados"}
          </Link>
        </div>

        {isEmpty ? (
          <EmptyState
            title="Nenhum processo na esteira"
            description="Cadastre o primeiro processo para acompanhar o andamento por fase."
          />
        ) : view === "kanban" ? (
          <KanbanBoard columns={columns} />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-3xl text-sm">
              <thead className="border-b border-line bg-surface-muted text-left text-xs text-ink-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">#</th>
                  <th className="px-5 py-2.5 font-medium">Cliente</th>
                  <th className="px-5 py-2.5 font-medium">Modalidade</th>
                  <th className="px-5 py-2.5 font-medium">Banco</th>
                  <th className="px-5 py-2.5 font-medium">Fase</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">Financiamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((process) => (
                  <tr key={process.id} className="relative hover:bg-surface-muted/60">
                    <td className="px-5 py-3 text-ink-muted">{process.number}</td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/processos/${process.id}`}
                        className="font-medium after:absolute after:inset-0 text-ink hover:text-brand-600 hover:underline"
                      >
                        {process.personName}
                      </Link>
                      <p className="text-xs text-ink-muted">{formatCpf(process.personCpf)}</p>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {process.modality ? MODALITY_LABELS[process.modality] : "—"}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{process.bankShortName ?? "—"}</td>
                    <td className="px-5 py-3 text-ink-muted">
                      {PROCESS_STAGE_LABELS[process.stage]}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={process.status} />
                    </td>
                    <td className="tabular px-5 py-3 text-right font-medium text-ink">
                      {formatBRL(process.financedValueCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </main>
    </>
  );
}
