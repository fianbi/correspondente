"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Loader2, UploadCloud, XCircle } from "lucide-react";
import { MAX_UPLOAD_BYTES } from "@corr/core";
import { createClient } from "@/lib/supabase/client";
import { Label } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  confirmDocumentUpload,
  prepareDocumentUpload,
  type DocumentOwner,
} from "@/server/actions/documents";

type FileState = { name: string; status: "enviando" | "ok" | "erro"; error?: string };

/**
 * Área de envio: escolhe tipo e dono acima, arrasta (ou clica) um ou vários
 * arquivos. Todos os arquivos de uma leva entram com o mesmo tipo e dono —
 * é o caso comum (frente e verso do RG, três holerites).
 *
 * O arquivo sobe direto do navegador para o Storage, com uma URL assinada pelo
 * servidor. Só os metadados voltam para a aplicação.
 */
export function DocumentUploader({
  owner,
  type,
  stageKey,
  fields,
}: {
  owner: DocumentOwner;
  type: string;
  stageKey?: string | null;
  /** Seletores de tipo e dono, desenhados por quem usa (processo ou pessoa). */
  fields: ReactNode;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<FileState[]>([]);
  const busy = files.some((file) => file.status === "enviando");

  function update(index: number, patch: Partial<FileState>) {
    setFiles((current) => current.map((file, i) => (i === index ? { ...file, ...patch } : file)));
  }

  async function sendOne(file: File, index: number) {
    if (file.size > MAX_UPLOAD_BYTES) {
      update(index, { status: "erro", error: "Arquivo acima de 20 MB." });
      return;
    }
    const { ticket, error } = await prepareDocumentUpload(owner, {
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (error || !ticket) {
      update(index, { status: "erro", error: error ?? "Falha ao preparar o envio." });
      return;
    }

    const { error: uploadError } = await createClient()
      .storage.from("documentos")
      .uploadToSignedUrl(ticket.path, ticket.token, file);
    if (uploadError) {
      update(index, { status: "erro", error: "Falha ao enviar o arquivo." });
      return;
    }

    const result = await confirmDocumentUpload({
      owner,
      path: ticket.path,
      title: file.name,
      type,
      stageKey,
    });
    update(index, result.error ? { status: "erro", error: result.error } : { status: "ok" });
  }

  async function send(list: FileList | File[]) {
    const batch = Array.from(list);
    if (batch.length === 0) return;
    setFiles(batch.map((file) => ({ name: file.name, status: "enviando" })));
    // Um por vez: a ordem de chegada fica igual à ordem escolhida.
    for (const [index, file] of batch.entries()) {
      try {
        await sendOne(file, index);
      } catch {
        update(index, { status: "erro", error: "Falha ao enviar o arquivo." });
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">{fields}</div>

      <div>
        <Label htmlFor={inputId}>Arquivo</Label>
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!busy) void send(event.dataTransfer.files);
          }}
          className={cn(
            "mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition",
            dragging ? "border-brand-500 bg-brand-50" : "border-line bg-surface-muted/50 hover:border-brand-300",
            busy ? "pointer-events-none opacity-60" : null,
          )}
        >
          <UploadCloud className="size-6 text-brand-600" aria-hidden />
          <span className="text-sm font-medium text-ink">
            Arraste os arquivos aqui ou <span className="text-brand-600 underline">escolha no computador</span>
          </span>
          <span className="text-xs text-ink-muted">PDF ou imagem, até 20 MB cada. Pode mandar vários de uma vez.</span>
        </label>
        <input
          id={inputId}
          ref={fileRef}
          type="file"
          multiple
          accept="application/pdf,image/*"
          disabled={busy}
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) void send(event.target.files);
          }}
        />
      </div>

      {files.length > 0 ? (
        <ul className="flex flex-col gap-1" aria-live="polite">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center gap-2 text-sm">
              {file.status === "enviando" ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-ink-muted" aria-hidden />
              ) : file.status === "ok" ? (
                <CheckCircle2 className="size-4 shrink-0 text-status-aprovado" aria-hidden />
              ) : (
                <XCircle className="size-4 shrink-0 text-status-reprovado" aria-hidden />
              )}
              <span className="min-w-0 truncate text-ink">{file.name}</span>
              <span
                role={file.status === "erro" ? "alert" : undefined}
                className={cn(
                  "shrink-0 text-xs",
                  file.status === "erro" ? "text-status-reprovado" : "text-ink-muted",
                )}
              >
                {file.status === "enviando" ? "Enviando…" : file.status === "ok" ? "Enviado" : file.error}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
