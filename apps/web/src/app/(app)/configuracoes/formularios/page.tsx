import type { Metadata } from "next";
import { listFormTemplates } from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { PageHeader } from "@/components/shell/page-header";
import { MODELOS_PRONTOS, origemPronta } from "@/server/pdf/modelos";
import { TemplatesPanel } from "./templates-panel";

export const metadata: Metadata = { title: "Formulários" };

export default async function FormulariosPage() {
  const ctx = await requireOrgContext();
  const templates = await listFormTemplates(ctx);

  return (
    <>
      <PageHeader
        title="Formulários"
        description="Formulários do banco, preenchidos automaticamente com os dados do processo."
      />

      <main className="max-w-4xl p-6">
        <TemplatesPanel
          templates={templates.map((template) => ({
            id: template.id,
            name: template.name,
            description: template.description,
            detectedFields: template.detectedFields,
            fieldMap: template.fieldMap,
          }))}
          prontos={MODELOS_PRONTOS.map((modelo) => ({
            chave: modelo.chave,
            nome: modelo.nome,
            descricao: modelo.descricao,
            adicionado: templates.some((template) => origemPronta(template)?.chave === modelo.chave),
          }))}
        />
      </main>
    </>
  );
}
