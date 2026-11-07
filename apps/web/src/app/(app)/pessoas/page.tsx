import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { formatCpf, formatPhone } from "@corr/core";
import { listPeople } from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { PageHeader, EmptyState } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";

export const metadata: Metadata = { title: "Pessoas" };

export default async function PessoasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { q } = await searchParams;
  const { rows, total } = await listPeople(ctx, { search: q });

  return (
    <>
      <PageHeader
        title="Pessoas"
        description="Cadastro mestre — a mesma pessoa é reaproveitada em todos os processos."
        action={
          <Link
            href="/pessoas/nova"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Plus className="size-4" aria-hidden />
            Nova pessoa
          </Link>
        }
      />

      <main className="flex flex-col gap-4 p-6">
        <SearchInput placeholder="Buscar por nome ou CPF" label="Buscar por nome ou CPF" />

        {rows.length === 0 ? (
          <EmptyState
            title={q ? "Nenhuma pessoa encontrada" : "Nenhuma pessoa cadastrada"}
            description={
              q
                ? "Ajuste a busca ou cadastre uma nova pessoa."
                : "Cadastre o primeiro proponente para começar a montar processos."
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-muted text-left text-xs text-ink-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Nome</th>
                  <th className="px-5 py-2.5 font-medium">CPF</th>
                  <th className="px-5 py-2.5 font-medium">Contato</th>
                  <th className="px-5 py-2.5 font-medium">Cidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((person) => (
                  <tr key={person.id} className="relative hover:bg-surface-muted/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/pessoas/${person.id}`}
                        className="font-medium after:absolute after:inset-0 text-ink hover:text-brand-600 hover:underline"
                      >
                        {person.fullName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{formatCpf(person.cpf)}</td>
                    <td className="px-5 py-3 text-ink-muted">
                      {person.phone ? formatPhone(person.phone) : person.email ? person.email : "—"}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {person.city ? `${person.city}${person.uf ? `/${person.uf}` : ""}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {rows.length > 0 ? (
          <p className="text-xs text-ink-muted">
            {rows.length} de {total} pessoa(s).
          </p>
        ) : null}
      </main>
    </>
  );
}
