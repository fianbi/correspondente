"use client";

import { useState } from "react";
import type { DocumentType } from "@corr/core";
import type { DocumentRow } from "@corr/db";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/field";
import { Select, type SelectOption } from "@/components/ui/select";
import { DocumentTypeSelect } from "@/components/documents/document-type-select";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { DocumentList } from "@/components/documents/document-list";

/**
 * Documentos da pessoa: tudo dela num lugar, venha do cadastro ou de qualquer
 * processo. O que entra aqui já aparece nos processos de que ela participa.
 */
export function PersonDocuments({
  personId,
  documents,
  processes,
}: {
  personId: string;
  documents: DocumentRow[];
  processes: SelectOption[];
}) {
  const [type, setType] = useState<DocumentType>("rg");
  const [processId, setProcessId] = useState("");

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title="Adicionar documento"
          description="Identidade, renda e endereço ficam com a pessoa e aparecem em todos os processos dela."
        />
        <CardBody>
          <DocumentUploader
            owner={{ personId, processId: processId || null }}
            type={type}
            fields={
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="person-document-type">Tipo</Label>
                  <DocumentTypeSelect
                    id="person-document-type"
                    value={type}
                    onChange={(event) => setType(event.target.value as DocumentType)}
                  />
                </div>
                {processes.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="person-document-process">Ligado a um processo?</Label>
                    <Select
                      id="person-document-process"
                      placeholder="Não, só no cadastro da pessoa"
                      options={processes}
                      value={processId}
                      onChange={(event) => setProcessId(event.target.value)}
                    />
                  </div>
                ) : null}
              </>
            }
          />
        </CardBody>
      </Card>

      <DocumentList
        context={{ kind: "pessoa" }}
        groups={[
          {
            key: "todos",
            title: "Documentos da pessoa",
            subtitle: "Do cadastro e de todos os processos.",
            emptyText: "Nenhum documento ainda. Envie acima ou pelo processo.",
            documents,
          },
        ]}
      />
    </div>
  );
}
