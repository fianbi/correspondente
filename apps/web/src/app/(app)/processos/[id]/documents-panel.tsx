"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Download, FileText, Trash2, Upload, X } from "lucide-react";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  MAX_UPLOAD_BYTES,
  type DocumentStatus,
  type DocumentType,
} from "@corr/core";
import type { ChecklistItem, DocumentRow } from "@corr/db";
import { createClient } from "@/lib/supabase/client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { Select, optionsFromLabels } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  confirmUpload,
  getDocumentUrl,
  prepareUpload,
  removeDocument,
  setDocumentStatus,
} from "./document-actions";

const TYPE_OPTIONS = optionsFromLabels(DOCUMENT_TYPE_LABELS);

const STATUS_CLASSES: Record<DocumentStatus, string> = {
  recebido: "bg-surface-muted text-ink-muted",
  aprovado: "bg-green-50 text-status-aprovado",
  rejeitado: "bg-red-50 text-status-reprovado",
};

export function DocumentsPanel({
  processId,
  stageKey,
  documents,
  checklist,
}: {
  processId: string;
  stageKey: string | null;
  documents: DocumentRow[];
  checklist: ChecklistItem[];
}) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<DocumentType>("rg");
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * O arquivo sobe direto do navegador para o Storage, com uma URL assinada
   * pelo servidor. Só os metadados voltam para a aplicação.
   */
  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      if (file.size > MAX_UPLOAD_BYTES) {
        setError("Arquivo acima de 20 MB.");
        return;
      }

      const { ticket, error: prepareError } = await prepareUpload(
        processId,
        file.name,
        file.type,
        file.size,
      );
      if (prepareError || !ticket) {
        setError(prepareError ?? "Falha ao preparar o envio.");
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .uploadToSignedUrl(ticket.path, ticket.token, file);

      if (uploadError) {
        setError("Falha ao enviar o arquivo.");
        return;
      }

      const result = await confirmUpload({
        processId,
        path: ticket.path,
        title: file.name,
        type,
        stageKey,
      });
      if (result.error) setError(result.error);
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  async function open(documentId: string) {
    const url = await getDocumentUrl(documentId);
    window.open(url, "_blank", "noopener");
  }

  return (
    <div className="flex flex-col gap-5">
      {checklist.length > 0 ? (
        <Card>
          <CardHeader
            title="Checklist da etapa"
            description="Documentos que esta fase exige."
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {checklist.map((item) => (
                <li key={item.documentType} className="flex items-center gap-3 px-5 py-2.5">
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full",
                      item.satisfied
                        ? "bg-status-aprovado text-white"
                        : item.required
                          ? "bg-red-50 text-status-reprovado"
                          : "bg-surface-muted text-ink-muted",
                    )}
                  >
                    {item.satisfied ? <Check className="size-3" aria-hidden /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      {DOCUMENT_TYPE_LABELS[item.documentType as DocumentType] ?? item.documentType}
                      {item.required ? null : (
                        <span className="ml-1 text-xs text-ink-muted">(opcional)</span>
                      )}
                    </p>
                    {item.note ? <p className="text-xs text-ink-muted">{item.note}</p> : null}
                  </div>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {item.satisfied ? "Recebido" : "Falta"}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Enviar documento" />
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="w-52">
            <Label htmlFor="document-type">Tipo</Label>
            <Select
              id="document-type"
              placeholder={null}
              options={TYPE_OPTIONS}
              value={type}
              onChange={(event) => setType(event.target.value as DocumentType)}
            />
          </div>
          <div className="min-w-56 flex-1">
            <Label htmlFor="document-file">Arquivo</Label>
            <input
              id="document-file"
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              disabled={uploading}
              className="h-10 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink file:mr-3 file:rounded file:border-0 file:bg-surface-muted file:px-2 file:py-1 file:text-sm file:text-ink"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
          </div>
          <p className="text-xs text-ink-muted">
            {uploading ? "Enviando…" : "PDF ou imagem, até 20 MB."}
          </p>
        </CardBody>
        {error ? (
          <CardBody className="border-t border-line pt-3">
            <p role="alert" className="text-sm text-status-reprovado">
              {error}
            </p>
          </CardBody>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Documentos do processo"
          description={documents.length === 0 ? "Nenhum documento recebido." : `${documents.length} arquivo(s).`}
        />
        {documents.length > 0 ? (
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {documents.map((document) => (
                <li key={document.id} className="flex items-center gap-3 px-5 py-3">
                  <FileText className="size-4 shrink-0 text-ink-muted" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => void open(document.id)}
                      className="truncate text-left text-sm font-medium text-ink hover:text-brand-600 hover:underline"
                    >
                      {document.title}
                    </button>
                    <p className="truncate text-xs text-ink-muted">
                      {DOCUMENT_TYPE_LABELS[document.type]} ·{" "}
                      {Math.max(1, Math.round(document.sizeBytes / 1024))} KB ·{" "}
                      {document.source === "portal"
                        ? `enviado por ${document.uploadedByName ?? "link de acesso"}`
                        : (document.uploaderName ?? "equipe")}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      STATUS_CLASSES[document.status],
                    )}
                  >
                    {DOCUMENT_STATUS_LABELS[document.status]}
                  </span>

                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton
                      label="Baixar"
                      onClick={() => void open(document.id)}
                      icon={<Download className="size-4" aria-hidden />}
                    />
                    {document.status !== "aprovado" ? (
                      <IconButton
                        label="Aprovar"
                        disabled={pending}
                        onClick={() =>
                          startTransition(() =>
                            void setDocumentStatus(processId, document.id, "aprovado"),
                          )
                        }
                        icon={<Check className="size-4" aria-hidden />}
                      />
                    ) : null}
                    {document.status !== "rejeitado" ? (
                      <IconButton
                        label="Rejeitar"
                        disabled={pending}
                        onClick={() =>
                          startTransition(() =>
                            void setDocumentStatus(processId, document.id, "rejeitado"),
                          )
                        }
                        icon={<X className="size-4" aria-hidden />}
                      />
                    ) : null}
                    <IconButton
                      label="Excluir"
                      disabled={pending}
                      onClick={() =>
                        startTransition(() => void removeDocument(processId, document.id))
                      }
                      icon={<Trash2 className="size-4" aria-hidden />}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        ) : (
          <CardBody className="flex items-center gap-2 text-sm text-ink-muted">
            <Upload className="size-4" aria-hidden />
            Envie o primeiro arquivo pelo campo acima, ou gere um link de acesso para o cliente
            enviar.
          </CardBody>
        )}
      </Card>
    </div>
  );
}

function IconButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
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
      {icon}
    </button>
  );
}
