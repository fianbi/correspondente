import Link from "next/link";
import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { NotFoundError } from "@corr/core";
import { getProcess, getSimulation } from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { PageHeader } from "@/components/shell/page-header";
import { SimulationForm } from "../simulation-form";

export const metadata: Metadata = { title: "Simulação" };

export default async function SimulacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext();
  const { id } = await params;

  const simulation = await getSimulation(ctx, id).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const process = simulation.processId
    ? await getProcess(ctx, simulation.processId).catch(() => null)
    : null;

  return (
    <>
      <PageHeader
        title={simulation.clientName}
        description="Simulação"
        action={
          process ? (
            <Link
              href={`/processos/${process.id}` as Route}
              className="inline-flex h-10 items-center rounded-md border border-line bg-white px-4 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              Ver processo #{process.number}
            </Link>
          ) : (
            <Link
              href={`/processos/novo?simulacao=${simulation.id}` as Route}
              className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              Abrir processo
            </Link>
          )
        }
      />
      <main className="max-w-5xl p-6">
        <SimulationForm simulation={simulation} />
      </main>
    </>
  );
}
