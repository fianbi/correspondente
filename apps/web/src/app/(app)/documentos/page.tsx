import type { Metadata } from "next";
import { PageHeader, EmptyState } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Documentos" };

export default function DocumentosPage() {
  return (
    <>
      <PageHeader title="Documentos" />
      <main className="p-6">
        <EmptyState
          title="Em construção"
          description="Documentos recebidos, checklist por fase e link de envio para terceiros. Previsto para a etapa M3 da implementação."
        />
      </main>
    </>
  );
}
