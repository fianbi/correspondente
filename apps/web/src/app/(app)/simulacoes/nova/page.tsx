import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { requireOrgContext } from "@/server/session";
import { SimulationForm } from "../simulation-form";

export const metadata: Metadata = { title: "Nova simulação" };

export default async function NovaSimulacaoPage() {
  await requireOrgContext();
  return (
    <>
      <PageHeader title="Nova simulação" />
      <main className="max-w-5xl p-4 sm:p-6">
        <SimulationForm />
      </main>
    </>
  );
}
