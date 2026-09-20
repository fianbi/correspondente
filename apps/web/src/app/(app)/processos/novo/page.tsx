import type { Metadata } from "next";
import { PageHeader, EmptyState } from "@/components/shell/page-header";
import { requireOrgContext } from "@/server/session";
import { loadProcessFormOptions } from "../form-options";
import { ProcessForm } from "../process-form";
import Link from "next/link";

export const metadata: Metadata = { title: "Novo processo" };

export default async function NovoProcessoPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { personId } = await searchParams;
  const options = await loadProcessFormOptions(ctx);

  return (
    <>
      <PageHeader title="Novo processo" />
      <main className="max-w-5xl p-6">
        {options.people.length === 0 ? (
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
          <ProcessForm options={options} defaultPersonId={personId} />
        )}
      </main>
    </>
  );
}
