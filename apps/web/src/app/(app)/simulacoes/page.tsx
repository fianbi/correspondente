import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { formatBRL } from "@corr/core";
import { listSimulations } from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { PageHeader, EmptyState } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Simulações" };

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export default async function SimulacoesPage() {
  const ctx = await requireOrgContext();
  const rows = await listSimulations(ctx);

  return (
    <>
      <PageHeader
        title="Simulações"
        description="Quem simulou, antes de virar processo. O processo nasce daqui quando o cliente segue."
        action={
          <Link
            href="/simulacoes/nova"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Plus className="size-4" aria-hidden />
            Nova simulação
          </Link>
        }
      />

      <main className="flex flex-col gap-4 p-4 sm:p-6">
        {rows.length === 0 ? (
          <EmptyState
            title="Nenhuma simulação ainda"
            description="Registre a primeira: nome, telefone e as sete perguntas bastam."
          />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-3xl text-sm">
              <thead className="border-b border-line bg-surface-muted text-left text-xs text-ink-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Cliente</th>
                  <th className="px-5 py-2.5 font-medium">Telefone</th>
                  <th className="px-5 py-2.5 text-right font-medium">Renda</th>
                  <th className="px-5 py-2.5 text-right font-medium">Valor do imóvel</th>
                  <th className="px-5 py-2.5 font-medium">Situação</th>
                  <th className="px-5 py-2.5 font-medium">Atualizada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.id} className="relative hover:bg-surface-muted/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/simulacoes/${row.id}`}
                        className="font-medium text-ink after:absolute after:inset-0 hover:text-brand-600 hover:underline"
                      >
                        {row.clientName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{row.clientPhone ?? "—"}</td>
                    <td className="tabular px-5 py-3 text-right">{formatBRL(row.familyIncomeCents)}</td>
                    <td className="tabular px-5 py-3 text-right">{formatBRL(row.propertyValueCents)}</td>
                    <td className="px-5 py-3 text-ink-muted">
                      {row.processNumber ? `Virou o processo #${row.processNumber}` : "Em aberto"}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{DATE.format(row.updatedAt)}</td>
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
