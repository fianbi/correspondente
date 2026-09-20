import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, FileText } from "lucide-react";
import {
  DOCUMENT_TYPE_LABELS,
  PROCESS_STAGES,
  PROCESS_STAGE_LABELS,
  type DocumentType,
  type ProcessStage,
} from "@corr/core";
import {
  getFlowConfig,
  getPortalParticipants,
  getPortalProcessSummary,
  getPortalStageRequirements,
  listPortalDocuments,
  registerPortalAccess,
  resolvePortalToken,
} from "@corr/db";
import { cn } from "@/lib/utils";
import { PortalUpload } from "./portal-upload";

export const metadata: Metadata = {
  title: "Acompanhamento do processo",
  robots: { index: false, follow: false },
};

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const session = await resolvePortalToken(token);
  if (!session) notFound();

  const [summary, participants, documents] = await Promise.all([
    getPortalProcessSummary(session),
    getPortalParticipants(session),
    listPortalDocuments(session),
    registerPortalAccess(session.linkId),
  ]);

  // O checklist mostrado é o da fase em que o processo está: pedir ao cliente
  // documento de uma etapa que ainda nem começou só gera confusão.
  const flow = summary.flowId
    ? await getFlowConfig({ orgId: session.orgId, userId: session.linkId, role: "owner" }, summary.flowId)
    : null;
  const stageConfig = flow?.stages.find((stage) => stage.key === summary.stage);
  const checklist = await getPortalStageRequirements(session, stageConfig?.requirements ?? []);

  const currentIndex = PROCESS_STAGES.indexOf(summary.stage as ProcessStage);
  const proponent = participants.find((p) => p.role === "proponente");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          Acompanhamento
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">
          Processo #{summary.number}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {proponent?.fullName ?? summary.clientName} · atualizado em{" "}
          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(summary.updatedAt)}
        </p>
      </header>

      <section
        aria-label="Andamento"
        className="rounded-lg border border-line bg-surface px-5 py-4"
      >
        <h2 className="text-sm font-semibold text-ink">Andamento</h2>
        <ol className="mt-3 flex flex-col gap-2">
          {PROCESS_STAGES.map((stage, index) => {
            const done = index < currentIndex;
            const current = index === currentIndex;
            return (
              <li key={stage} className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                    done
                      ? "bg-status-aprovado text-white"
                      : current
                        ? "bg-brand-600 text-white"
                        : "bg-surface-muted text-ink-muted",
                  )}
                >
                  {done ? <Check className="size-3" aria-hidden /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    current ? "font-medium text-ink" : done ? "text-ink-muted" : "text-ink-muted/70",
                  )}
                >
                  {PROCESS_STAGE_LABELS[stage]}
                  {current ? " — etapa atual" : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {checklist.length > 0 ? (
        <section
          aria-label="Documentos solicitados"
          className="rounded-lg border border-line bg-surface px-5 py-4"
        >
          <h2 className="text-sm font-semibold text-ink">Documentos solicitados</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {checklist.map((item) => (
              <li key={item.documentType} className="flex items-center gap-2.5 text-sm">
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full",
                    item.satisfied
                      ? "bg-status-aprovado text-white"
                      : "border border-line bg-white",
                  )}
                >
                  {item.satisfied ? <Check className="size-3" aria-hidden /> : null}
                </span>
                <span className={item.satisfied ? "text-ink-muted" : "text-ink"}>
                  {DOCUMENT_TYPE_LABELS[item.documentType as DocumentType] ?? item.documentType}
                  {item.required ? "" : " (opcional)"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {session.canUpload ? (
        <PortalUpload token={token} defaultSenderName={session.label} />
      ) : (
        <p className="rounded-lg border border-line bg-surface px-5 py-4 text-sm text-ink-muted">
          Este link é apenas para acompanhamento. Para enviar documentos, peça ao escritório um
          link com permissão de envio.
        </p>
      )}

      {documents.length > 0 ? (
        <section
          aria-label="Documentos enviados"
          className="rounded-lg border border-line bg-surface"
        >
          <h2 className="border-b border-line px-5 py-3 text-sm font-semibold text-ink">
            Enviados por este link
          </h2>
          <ul className="divide-y divide-line">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center gap-3 px-5 py-3">
                <FileText className="size-4 shrink-0 text-ink-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{document.title}</p>
                  <p className="text-xs text-ink-muted">
                    {DOCUMENT_TYPE_LABELS[document.type]}
                    {document.uploadedByName ? ` · ${document.uploadedByName}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-ink-muted">
                  {document.status === "aprovado"
                    ? "Aprovado"
                    : document.status === "rejeitado"
                      ? "Reenviar"
                      : "Em análise"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="text-xs text-ink-muted">
        Link pessoal de acompanhamento. Não compartilhe: quem tiver o endereço vê este processo.
      </footer>
    </main>
  );
}
