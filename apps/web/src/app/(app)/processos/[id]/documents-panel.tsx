"use client";

import { useRef, useState } from "react";
import { Check, Upload } from "lucide-react";
import { DOCUMENT_TYPE_LABELS, isProcessDocumentType, type DocumentType } from "@corr/core";
import type { ChecklistItem, DocumentRow } from "@corr/db";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { Select, type SelectOption } from "@/components/ui/select";
import { DocumentTypeSelect } from "@/components/documents/document-type-select";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { DocumentList, type DocumentGroup } from "@/components/documents/document-list";
import { cn } from "@/lib/utils";
import { AccessLinksCard, type AccessLinkRow } from "./access-links-card";

/** Valor do seletor "De quem é" para documento do imóvel ou do contrato. */
const PROCESS_OWNER = "processo";

export interface ProcessPerson {
  personId: string;
  fullName: string;
  /** Papéis no processo, já com rótulo: "Proponente", "Vendedor"… */
  roles: string[];
}

/**
 * Documentos do processo, organizados por dono.
 *
 * Cada participante tem a sua pasta e o processo tem a dele (matrícula,
 * contrato, laudo). Documento pessoal enviado aqui vai também para o cadastro
 * da pessoa, e o que ela já tinha de outro processo aparece aqui sem reenvio.
 */
export function DocumentsPanel({
  processId,
  stageKey,
  stepLabel,
  documents,
  checklist,
  people,
  links,
  portalBaseUrl,
  canDelete,
  parts = { checklist: true, uploader: true, list: true, links: true },
}: {
  processId: string;
  stageKey: string | null;
  stepLabel: string;
  documents: DocumentRow[];
  checklist: ChecklistItem[];
  people: ProcessPerson[];
  links: AccessLinkRow[];
  portalBaseUrl: string;
  canDelete: boolean;
  /**
   * Partes a mostrar. Na etapa aberta vão o checklist e o envio; a lista
   * completa e os links para o cliente ficam em "Todos os documentos".
   */
  parts?: {
    checklist?: boolean;
    uploader?: boolean;
    list?: boolean;
    links?: boolean;
  };
}) {
  const firstPerson = people[0]?.personId ?? PROCESS_OWNER;
  const [type, setType] = useState<DocumentType>("rg");
  const [owner, setOwner] = useState<string>(firstPerson);
  const uploaderRef = useRef<HTMLDivElement>(null);

  const ownerOptions: SelectOption[] = [
    ...people.map((person) => ({
      value: person.personId,
      label: `${person.fullName} (${person.roles.join(", ")})`,
    })),
    { value: PROCESS_OWNER, label: "Do processo: imóvel, contrato, laudo" },
  ];

  // O tipo puxa o dono: matrícula é do processo, RG é de alguém. O operador
  // ainda pode trocar, mas o padrão já sai certo.
  function chooseType(next: DocumentType) {
    setType(next);
    if (isProcessDocumentType(next)) setOwner(PROCESS_OWNER);
    else if (owner === PROCESS_OWNER) setOwner(firstPerson);
  }

  function requestFromChecklist(next: DocumentType) {
    chooseType(next);
    uploaderRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    uploaderRef.current?.querySelector<HTMLSelectElement>("select")?.focus();
  }

  const groups: DocumentGroup[] = [
    ...people.map((person) => ({
      key: person.personId,
      title: person.fullName,
      subtitle: person.roles.join(", "),
      emptyText: "Nenhum documento desta pessoa ainda.",
      documents: documents.filter((document) => document.personId === person.personId),
    })),
    {
      key: PROCESS_OWNER,
      title: "Do processo",
      subtitle: "Imóvel, contrato, laudo e o que não é de uma pessoa só.",
      emptyText: "Nenhum documento do processo ainda.",
      documents: documents.filter(
        (document) => !document.personId && document.processId === processId,
      ),
    },
  ];
  // Pessoa que saiu do processo continua com os arquivos enviados nele.
  const known = new Set(people.map((person) => person.personId));
  const orphans = documents.filter(
    (document) =>
      document.personId && !known.has(document.personId) && document.processId === processId,
  );
  if (orphans.length > 0) {
    groups.push({
      key: "fora",
      title: "De quem não participa mais",
      documents: orphans,
    });
  }

  const missing = checklist.filter((item) => !item.satisfied);

  return (
    <div className="flex flex-col gap-5">
      {parts.checklist && checklist.length > 0 ? (
        <Card>
          <CardHeader
            title="Documentos da etapa"
            description={
              missing.length === 0
                ? "Tudo recebido."
                : `Faltam ${missing.length} de ${checklist.length}. Clique em Enviar para já deixar o tipo escolhido.`
            }
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {checklist.map((item) => {
                const label =
                  DOCUMENT_TYPE_LABELS[item.documentType as DocumentType] ?? item.documentType;
                const from = [...new Set(item.received.map((r) => r.personName).filter(Boolean))];
                return (
                  <li key={item.documentType} className="flex items-center gap-3 px-5 py-2.5">
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full",
                        item.satisfied
                          ? "bg-status-aprovado text-white"
                          : item.required
                            ? "border-2 border-status-reprovado/40 bg-white"
                            : "border border-line bg-white",
                      )}
                    >
                      {item.satisfied ? <Check className="size-3" aria-hidden /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        {label}
                        {item.required ? null : (
                          <span className="ml-1 text-xs text-ink-muted">(opcional)</span>
                        )}
                      </p>
                      {item.note ? <p className="text-xs text-ink-muted">{item.note}</p> : null}
                    </div>
                    {item.satisfied ? (
                      <span className="shrink-0 text-xs text-status-aprovado">
                        Recebido{from.length > 0 ? ` · ${from.join(", ")}` : ""}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => requestFromChecklist(item.documentType as DocumentType)}
                        aria-label={`Enviar ${label}`}
                      >
                        <Upload className="size-3.5" aria-hidden />
                        Enviar
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {parts.uploader ? (
        <div ref={uploaderRef}>
          <Card>
            <CardHeader
              title="Adicionar documento"
              description="Documento pessoal enviado aqui também fica no cadastro da pessoa e vale para os outros processos dela."
            />
            <CardBody>
              <DocumentUploader
                owner={owner === PROCESS_OWNER ? { processId } : { processId, personId: owner }}
                type={type}
                stageKey={stageKey}
                fields={
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="document-type">Tipo</Label>
                      <DocumentTypeSelect
                        id="document-type"
                        value={type}
                        onChange={(event) => chooseType(event.target.value as DocumentType)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="document-owner">De quem é</Label>
                      <Select
                        id="document-owner"
                        placeholder={null}
                        options={ownerOptions}
                        value={owner}
                        onChange={(event) => setOwner(event.target.value)}
                      />
                    </div>
                  </>
                }
              />
            </CardBody>
          </Card>
        </div>
      ) : null}

      {parts.list ? (
        <DocumentList
          groups={groups}
          context={{ kind: "processo", processId }}
          canDelete={canDelete}
          ownerOptions={people.map((person) => ({
            value: person.personId,
            label: person.fullName,
          }))}
        />
      ) : null}

      {parts.links ? (
        <AccessLinksCard processId={processId} links={links} portalBaseUrl={portalBaseUrl} />
      ) : null}
    </div>
  );
}
