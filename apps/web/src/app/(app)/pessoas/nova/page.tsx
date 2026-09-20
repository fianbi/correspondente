import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PersonForm } from "../person-form";

export const metadata: Metadata = { title: "Nova pessoa" };

export default function NovaPessoaPage() {
  return (
    <>
      <PageHeader title="Nova pessoa" description="Só CPF e nome são obrigatórios; o resto pode ser completado depois." />
      <main className="max-w-5xl p-6">
        <PersonForm />
      </main>
    </>
  );
}
