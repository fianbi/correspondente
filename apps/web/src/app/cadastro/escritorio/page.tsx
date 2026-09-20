import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listMembershipsForUser } from "@corr/db";
import { requireSessionUser } from "@/server/session";
import { OrgForm } from "./org-form";

export const metadata: Metadata = { title: "Novo escritório" };

export default async function NovoEscritorioPage() {
  const user = await requireSessionUser();
  const memberships = await listMembershipsForUser(user.id);
  if (memberships.length > 0) redirect("/painel");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Passo 2 de 2</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Cadastre seu escritório</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Todos os processos, pessoas e documentos ficam isolados dentro dele.
        </p>
      </div>

      <OrgForm />
    </main>
  );
}
