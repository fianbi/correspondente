"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState, useTransition } from "react";
import { Check, Download, FileImage, FileText, Pencil, Trash2, X } from "lucide-react";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  type DocumentStatus,
  type DocumentType,
} from "@corr/core";
import type { DocumentRow } from "@corr/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Select, type SelectOption } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  editDocument,
  getDocumentUrl,
  removeDocument,
  setDocumentStatus,
} from "@/server/actions/documents";
import { DocumentTypeSelect } from "./document-type-select";

const STATUS_CLASSES: Record<DocumentStatus, string> = {
  recebido: "bg-amber-50 text-status-aguardando",
  aprovado: "bg-green-50 text-status-aprovado",
  rejeitado: "bg-red-50 text-status-reprovado",
};

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export interface DocumentGroup {
  key: string;
  title: string;
  subtitle?: string;
  emptyText?: string;
  documents: DocumentRow[];
}

/**
 * Lista de documentos agrupada (por pessoa no processo, por origem na
 * pessoa). Cada linha mostra de onde o arquivo veio — processo, cadastro ou
 * link do cliente — e as ações de conferência ficam à vista, com texto, em vez
 * de ícones soltos.
 */
export function DocumentList({
  groups,
  context,
  ownerOptions,
}: {
  groups: DocumentGroup[];
  /** Onde a lista aparece: muda o texto de origem de cada linha. */
  context: { kind: "processo"; processId: string } | { kind: "pessoa" };
  /** Pessoas a quem um documento pode ser atribuído na edição. */
  ownerOptions?: SelectOption[];
}) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.title} className="rounded-lg border border-line bg-surface shadow-sm">
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">{group.title}</h3>
              {group.subtitle ? <p className="text-xs text-ink-muted">{group.subtitle}</p> : null}
            </div>
            <span className="text-xs text-ink-muted">
              {group.documents.length === 0
                ? "Nenhum arquivo"
                : `${group.documents.length} arquivo${group.documents.length > 1 ? "s" : ""}`}
            </span>
          </header>
          {group.documents.length === 0 ? (
            <p className="px-5 py-3 text-sm text-ink-muted">{group.emptyText ?? "Nenhum documento ainda."}</p>
          ) : (
            <ul className="divide-y divide-line">
              {group.documents.map((document) => (
                <DocumentItem
                  key={document.id}
                  document={document}
                  context={context}
                  ownerOptions={ownerOptions}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function originText(
  document: DocumentRow,
  context: { kind: "processo"; processId: string } | { kind: "pessoa" },
): { text: string; href?: Route } | null {
  if (context.kind === "processo") {
    if (document.processId === context.processId) return null;
    if (document.processId) {
      return { text: `do processo #${document.processNumber}`, href: `/processos/${document.processId}?aba=documentos` as Route };
    }
    return { text: "do cadastro da pessoa", href: `/pessoas/${document.personId}?aba=documentos` as Route };
  }
  if (document.processId) {
    return { text: `processo #${document.processNumber}`, href: `/processos/${document.processId}?aba=documentos` as Route };
  }
  return { text: "cadastro" };
}

function DocumentItem({
  document,
  context,
  ownerOptions,
}: {
  document: DocumentRow;
  context: { kind: "processo"; processId: string } | { kind: "pessoa" };
  ownerOptions?: SelectOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"view" | "rejecting" | "editing">("view");
  const [reason, setReason] = useState("");
  const [type, setType] = useState<string>(document.type);
  const [personId, setPersonId] = useState(document.personId ?? "");
  const [error, setError] = useState<string | null>(null);

  const origin = originText(document, context);
  const isImage = document.mimeType.startsWith("image/");
  const Icon = isImage ? FileImage : FileText;
  const sender =
    document.source === "portal"
      ? `enviado por ${document.uploadedByName ?? "link de acesso"}`
      : (document.uploaderName ?? "equipe");

  async function open() {
    const url = await getDocumentUrl(document.id);
    window.open(url, "_blank", "noopener");
  }

  const review = (status: DocumentStatus, notes?: string) =>
    startTransition(async () => {
      await setDocumentStatus(document.id, status, notes);
      setMode("view");
      setReason("");
    });

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Icon className="size-5 shrink-0 text-ink-muted" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium text-ink">{DOCUMENT_TYPE_LABELS[document.type]}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                STATUS_CLASSES[document.status],
              )}
            >
              {DOCUMENT_STATUS_LABELS[document.status]}
            </span>
          </p>
          <button
            type="button"
            onClick={() => void open()}
            className="max-w-full truncate text-left text-sm text-brand-600 hover:underline"
            title="Abrir o arquivo em outra aba"
          >
            {document.title}
          </button>
          <p className="text-xs text-ink-muted">
            {DATE.format(new Date(document.createdAt))} · {Math.max(1, Math.round(document.sizeBytes / 1024))} KB ·{" "}
            {sender}
            {origin ? (
              <>
                {" · "}
                {origin.href ? (
                  <Link href={origin.href} className="underline-offset-2 hover:text-ink hover:underline">
                    {origin.text}
                  </Link>
                ) : (
                  origin.text
                )}
              </>
            ) : null}
          </p>
          {document.status === "rejeitado" && document.reviewNotes ? (
            <p className="mt-1 text-xs text-status-reprovado">Motivo: {document.reviewNotes}</p>
          ) : null}
        </div>

        {mode === "view" ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => void open()}>
              <Download className="size-4" aria-hidden />
              Abrir
            </Button>
            {document.status !== "aprovado" ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => review("aprovado")}
              >
                <Check className="size-4" aria-hidden />
                Aprovar
              </Button>
            ) : null}
            {document.status !== "rejeitado" ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => setMode("rejecting")}
              >
                <X className="size-4" aria-hidden />
                Rejeitar
              </Button>
            ) : null}
            <IconButton label="Corrigir tipo ou pessoa" onClick={() => setMode("editing")}>
              <Pencil className="size-4" aria-hidden />
            </IconButton>
            <IconButton
              label="Excluir"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Excluir "${document.title}"? O arquivo é apagado e não volta.`)) {
                  startTransition(() => removeDocument(document.id));
                }
              }}
            >
              <Trash2 className="size-4" aria-hidden />
            </IconButton>
          </div>
        ) : null}
      </div>

      {mode === "rejecting" ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2 pl-8"
          onSubmit={(event) => {
            event.preventDefault();
            review("rejeitado", reason);
          }}
        >
          <Input
            aria-label="Motivo da rejeição"
            autoFocus
            placeholder="Motivo (opcional): ilegível, vencido, falta o verso…"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="h-8 min-w-60 flex-1"
          />
          <Button type="submit" variant="danger" size="sm" disabled={pending}>
            Confirmar rejeição
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode("view")}>
            Cancelar
          </Button>
        </form>
      ) : null}

      {mode === "editing" ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2 pl-8"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await editDocument(document.id, { type, personId: personId || null });
              setError(result.error ?? null);
              if (!result.error) setMode("view");
            });
          }}
        >
          <DocumentTypeSelect
            aria-label="Tipo do documento"
            className="h-8 w-56"
            value={type}
            onChange={(event) => setType(event.target.value as DocumentType)}
          />
          {ownerOptions && ownerOptions.length > 0 ? (
            <Select
              aria-label="De quem é"
              className="h-8 w-64"
              placeholder={document.processId ? "Do processo (sem pessoa)" : null}
              options={ownerOptions}
              value={personId}
              onChange={(event) => setPersonId(event.target.value)}
            />
          ) : null}
          <Button type="submit" size="sm" disabled={pending}>
            Salvar
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode("view")}>
            Cancelar
          </Button>
          {error ? (
            <p role="alert" className="w-full text-sm text-status-reprovado">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md p-1.5 text-ink-muted transition hover:bg-surface-muted hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}
