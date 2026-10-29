import Link from "next/link";
import type { Metadata, Route } from "next";
import { FileText } from "lucide-react";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "@corr/core";
import { listOrgDocuments } from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { PageHeader, EmptyState } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Documentos" };

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export default async function DocumentosPage() {
  const ctx = await requireOrgContext();
  const documents = await listOrgDocuments(ctx);

  return (
    <>
      <PageHeader
        title="Documentos"
        description="Tudo que chegou, de todos os processos."
      />

      <main className="p-6">
        {documents.length === 0 ? (
          <EmptyState
            title="Nenhum documento recebido"
            description="Os arquivos aparecem aqui conforme a equipe envia ou o cliente usa o link de acesso."
          />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-muted text-left text-xs text-ink-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Documento</th>
                  <th className="px-5 py-2.5 font-medium">Tipo</th>
                  <th className="px-5 py-2.5 font-medium">Origem</th>
                  <th className="px-5 py-2.5 font-medium">Situação</th>
                  <th className="px-5 py-2.5 font-medium">Recebido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {documents.map((document) => (
                  <tr key={document.id} className="relative hover:bg-surface-muted/60">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        <FileText className="size-4 shrink-0 text-ink-muted" aria-hidden />
                        {document.processId ? (
                          <Link
                            href={`/processos/${document.processId}?aba=documentos` as Route}
                            className="font-medium after:absolute after:inset-0 text-ink hover:text-brand-600 hover:underline"
                          >
                            {document.title}
                          </Link>
                        ) : (
                          <span className="font-medium text-ink">{document.title}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {DOCUMENT_TYPE_LABELS[document.type]}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {document.source === "portal"
                        ? (document.uploadedByName ?? "Link de acesso")
                        : (document.uploaderName ?? "Equipe")}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {DOCUMENT_STATUS_LABELS[document.status]}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{DATE.format(document.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </main>
    </>
  );
}
