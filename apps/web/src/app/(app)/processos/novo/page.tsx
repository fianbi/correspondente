import type { Metadata } from "next";
import { PageHeader, EmptyState } from "@/components/shell/page-header";
import { getSimulation } from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { loadProcessFormOptions } from "../form-options";
import { ProcessForm } from "../process-form";
import Link from "next/link";

export const metadata: Metadata = { title: "Novo processo" };

export default async function NovoProcessoPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string; simulacao?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { personId, simulacao } = await searchParams;
  const [options, simulation] = await Promise.all([
    loadProcessFormOptions(ctx),
    simulacao ? getSimulation(ctx, simulacao).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader title="Novo processo" description="Só a modalidade e quem participa. O resto se preenche etapa por etapa." />
      <main className="max-w-3xl p-6">
        {options.people.length === 0 && !simulation ? (
          <EmptyState
            title="Cadastre uma pessoa primeiro"
            description="Todo processo começa por um proponente. Cadastre a pessoa e volte aqui."
            action={
              <Link
                href="/pessoas/nova"
                className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
              >
                Cadastrar pessoa
              </Link>
            }
          />
        ) : (
          <ProcessForm
            options={options}
            defaultPersonId={personId}
            simulation={simulation ? { id: simulation.id, clientName: simulation.clientName } : undefined}
          />
        )}
      </main>
    </>
  );
}
