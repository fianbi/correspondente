import Link from "next/link";
import type { Metadata, Route } from "next";
import { Plus, Search } from "lucide-react";
import { MODALITY_LABELS, formatBRL, formatCpf } from "@corr/core";
import { currentStepOf, listProcesses } from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { PageHeader, EmptyState } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Processos" };

/**
 * Lista de processos com a etapa em que cada um está. Já houve um Kanban
 * aqui; com o roteiro variando por modalidade, as colunas viravam dezenas, e
 * a lista com a etapa diz o mesmo de forma mais legível.
 */
export default async function ProcessosPage({
  searchParams,
}: {
  searchParams: Promise<{ encerrados?: string; q?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { encerrados, q } = await searchParams;
  const includeClosed = encerrados === "1";

  const rows = await listProcesses(ctx, { includeClosed, search: q });
  const filterHref = (closed: boolean) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (closed) params.set("encerrados", "1");
    const query = params.toString();
    return (query ? `/processos?${query}` : "/processos") as Route;
  };

  return (
    <>
      <PageHeader
        title="Processos"
        description="Todos os processos e a etapa em que cada um está."
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
          <form className="relative max-w-md min-w-60 flex-1" role="search">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <Input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Buscar por cliente, CPF ou número"
              aria-label="Buscar processo"
              className="pl-9"
            />
            {includeClosed ? <input type="hidden" name="encerrados" value="1" /> : null}
          </form>
          <div className="flex rounded-md border border-line bg-white p-0.5 text-sm" role="group" aria-label="Quais processos">
            {[
              { closed: false, label: "Em andamento" },
              { closed: true, label: "Todos, inclusive encerrados" },
            ].map((option) => (
              <Link
                key={option.label}
                href={filterHref(option.closed)}
                aria-current={includeClosed === option.closed ? "page" : undefined}
                className={cn(
                  "rounded px-3 py-1.5 transition",
                  includeClosed === option.closed
                    ? "bg-brand-50 font-medium text-brand-700"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={q ? "Nenhum processo encontrado" : "Nenhum processo em andamento"}
            description={
              q
                ? "Confira o nome ou o CPF, ou inclua os encerrados na busca."
                : "Abra o primeiro processo para acompanhar o andamento por etapa."
            }
          />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-3xl text-sm">
              <thead className="border-b border-line bg-surface-muted text-left text-xs text-ink-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">#</th>
                  <th className="px-5 py-2.5 font-medium">Cliente</th>
                  <th className="px-5 py-2.5 font-medium">Modalidade</th>
                  <th className="px-5 py-2.5 font-medium">Banco</th>
                  <th className="px-5 py-2.5 font-medium">Etapa</th>
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
                      {currentStepOf(process).label}
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
