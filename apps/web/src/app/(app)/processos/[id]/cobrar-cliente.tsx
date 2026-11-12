"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { linkDoWhatsApp, mensagemDeCobranca } from "@/lib/whatsapp";

export interface Destinatario {
  personId: string;
  fullName: string;
  phone: string | null;
  roles: string[];
}

/**
 * Mensagem pronta para cobrar o cliente do que falta.
 *
 * Junta os documentos que a etapa ainda pede e as pendências abertas num texto
 * só, que abre no WhatsApp já endereçado ao celular do cadastro. O texto fica
 * editável: a mensagem é do operador, o sistema só poupa a digitação.
 */
export function CobrarCliente({
  escritorio,
  processNumber,
  etapa,
  destinatarios,
  documentosFaltando,
  pendencias,
}: {
  escritorio: string;
  processNumber: number;
  etapa: string;
  destinatarios: Destinatario[];
  documentosFaltando: { label: string; required: boolean }[];
  pendencias: string[];
}) {
  const inicial = destinatarios.find((d) => d.phone) ?? destinatarios[0];
  const [personId, setPersonId] = useState(inicial?.personId ?? "");
  const pessoa = destinatarios.find((d) => d.personId === personId) ?? inicial;

  const gerar = (nome: string | undefined) =>
    mensagemDeCobranca({
      nome: nome ?? "",
      escritorio,
      processNumber,
      etapa,
      documentos: documentosFaltando,
      pendencias,
    });

  const [texto, setTexto] = useState(() => gerar(inicial?.fullName));
  const [copiado, setCopiado] = useState(false);

  if (documentosFaltando.length === 0 && pendencias.length === 0) return null;

  const link = pessoa?.phone ? linkDoWhatsApp(pessoa.phone, texto) : null;

  async function copiar() {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <Card>
      <CardHeader
        title="Cobrar o cliente"
        description={`Mensagem pronta com ${[
          documentosFaltando.length ? `${documentosFaltando.length} documento(s)` : null,
          pendencias.length ? `${pendencias.length} pendência(s)` : null,
        ]
          .filter(Boolean)
          .join(" e ")} em aberto. Ajuste o texto se quiser e mande pelo WhatsApp.`}
      />
      <CardBody className="flex flex-col gap-3">
        {destinatarios.length > 1 ? (
          <div className="flex max-w-md flex-col gap-1.5">
            <Label htmlFor="cobrar-para">Para quem</Label>
            <Select
              id="cobrar-para"
              placeholder={null}
              value={personId}
              onChange={(event) => {
                const proxima = destinatarios.find((d) => d.personId === event.target.value);
                setPersonId(event.target.value);
                setTexto(gerar(proxima?.fullName));
              }}
              options={destinatarios.map((d) => ({
                value: d.personId,
                label: `${d.fullName} (${d.roles.join(", ")})${d.phone ? "" : " · sem celular"}`,
              }))}
            />
          </div>
        ) : null}

        <textarea
          aria-label="Mensagem"
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          rows={Math.min(14, texto.split("\n").length + 1)}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-2">
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[#1f8f4e] px-3 text-sm font-medium text-white transition hover:brightness-110"
            >
              <MessageCircle className="size-4" aria-hidden />
              Abrir no WhatsApp
            </a>
          ) : (
            <p className="text-sm text-ink-muted">
              {pessoa ? `${pessoa.fullName} não tem celular no cadastro.` : "Sem destinatário."}{" "}
              Copie a mensagem e mande por onde preferir.
            </p>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={copiar}>
            {copiado ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
            {copiado ? "Copiado" : "Copiar"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
