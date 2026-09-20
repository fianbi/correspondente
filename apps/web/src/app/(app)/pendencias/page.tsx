import Link from "next/link";
import type { Metadata, Route } from "next";
import { listOpenPendencies } from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { PageHeader, EmptyState } from "@/components/shell/page-header";
import { Card, CardBody } from "@/components/ui/card";

export const metadata: Metadata = { title: "Pendências" };

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export default async function PendenciasPage() {
  const ctx = await requireOrgContext();
  const pendencies = await listOpenPendencies(ctx);

  return (
    <>
      <PageHeader
        title="Pendências"
        description="Tudo que está travando processos, em um lugar só."
      />

      <main className="p-6">
        {pendencies.length === 0 ? (
          <EmptyState
            title="Nenhuma pendência aberta"
            description="Quando algo travar um processo, registre como pendência para não depender da memória de ninguém."
          />
        ) : (
          <Card>
            <CardBody className="p-0">
              <ul className="divide-y divide-line">
                {pendencies.map((pendency) => (
                  <li key={pendency.id} className="flex items-start justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{pendency.title}</p>
                      {pendency.description ? (
                        <p className="text-xs text-ink-muted">{pendency.description}</p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-ink-muted">
                        <Link
                          href={`/processos/${pendency.processId}?aba=pendencias` as Route}
                          className="hover:text-ink hover:underline"
                        >
                          #{pendency.processNumber} {pendency.clientName}
                        </Link>
                        {pendency.assignedToName ? ` · ${pendency.assignedToName}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {DATE.format(pendency.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </main>
    </>
  );
}
