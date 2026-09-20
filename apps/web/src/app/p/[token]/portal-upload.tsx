"use client";

import { useRef, useState } from "react";
import { DOCUMENT_TYPE_LABELS, MAX_UPLOAD_BYTES, type DocumentType } from "@corr/core";
import { createClient } from "@/lib/supabase/client";
import { Input, Label } from "@/components/ui/field";
import { Select, optionsFromLabels } from "@/components/ui/select";
import { confirmPortalUpload, preparePortalUpload } from "./portal-actions";

const TYPE_OPTIONS = optionsFromLabels(DOCUMENT_TYPE_LABELS);

/**
 * Envio de documento pelo terceiro.
 *
 * O arquivo vai direto do navegador para o armazenamento, com permissão
 * assinada pelo servidor — nem o arquivo nem o token de upload passam por
 * quem não deveria vê-los.
 */
export function PortalUpload({
  token,
  defaultSenderName,
}: {
  token: string;
  defaultSenderName: string;
}) {
  const [type, setType] = useState<DocumentType>("rg");
  const [senderName, setSenderName] = useState(defaultSenderName);
  const [status, setStatus] = useState<"idle" | "enviando" | "ok">("idle");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setError(null);
    setStatus("enviando");
    try {
      if (file.size > MAX_UPLOAD_BYTES) {
        setError("Arquivo acima de 20 MB.");
        setStatus("idle");
        return;
      }

      const { ticket, error: prepareError } = await preparePortalUpload(
        token,
        file.name,
        file.type,
        file.size,
      );
      if (prepareError || !ticket) {
        setError(prepareError ?? "Falha ao preparar o envio.");
        setStatus("idle");
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .uploadToSignedUrl(ticket.path, ticket.token, file);

      if (uploadError) {
        setError("Falha ao enviar o arquivo. Tente novamente.");
        setStatus("idle");
        return;
      }

      const result = await confirmPortalUpload({
        token,
        path: ticket.path,
        title: file.name,
        type,
        senderName,
      });

      if (result.error) {
        setError(result.error);
        setStatus("idle");
        return;
      }

      if (fileRef.current) fileRef.current.value = "";
      setStatus("ok");
    } catch {
      setError("Falha ao enviar o arquivo. Tente novamente.");
      setStatus("idle");
    }
  }

  return (
    <section aria-label="Enviar documento" className="rounded-lg border border-line bg-surface px-5 py-4">
      <h2 className="text-sm font-semibold text-ink">Enviar documento</h2>

      <div className="mt-3 flex flex-col gap-3">
        <div>
          <Label htmlFor="portal-sender">Seu nome</Label>
          <Input
            id="portal-sender"
            value={senderName}
            onChange={(event) => setSenderName(event.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="portal-type">Tipo de documento</Label>
          <Select
            id="portal-type"
            placeholder={null}
            options={TYPE_OPTIONS}
            value={type}
            onChange={(event) => setType(event.target.value as DocumentType)}
          />
        </div>

        <div>
          <Label htmlFor="portal-file">Arquivo</Label>
          <input
            id="portal-file"
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            disabled={status === "enviando"}
            className="h-10 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink file:mr-3 file:rounded file:border-0 file:bg-surface-muted file:px-2 file:py-1 file:text-sm file:text-ink"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
          <p className="mt-1 text-xs text-ink-muted">PDF ou foto do documento, até 20 MB.</p>
        </div>

        {status === "enviando" ? (
          <p role="status" className="text-sm text-ink-muted">
            Enviando…
          </p>
        ) : null}
        {status === "ok" ? (
          <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-status-aprovado">
            Documento enviado. O escritório vai conferir e avisar se precisar de algo.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-status-reprovado">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
