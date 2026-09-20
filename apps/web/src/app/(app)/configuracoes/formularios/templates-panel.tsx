"use client";

import { useActionState, useState, useTransition } from "react";
import { FileText, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  removeTemplate,
  saveFieldMap,
  uploadTemplate,
  type TemplateState,
} from "./actions";

export interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  detectedFields: string[];
  fieldMap: Record<string, string>;
}

export function TemplatesPanel({
  templates,
  opcoes,
}: {
  templates: TemplateRow[];
  opcoes: { value: string; label: string }[];
}) {
  const [uploadState, uploadAction] = useActionState<TemplateState, FormData>(uploadTemplate, {});
  const [aberto, setAberto] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader
          title="Novo modelo"
          description="Envie o PDF em branco que o banco distribui. Ele precisa ter campos preenchíveis."
        />
        <CardBody>
          <form action={uploadAction} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" name="name" placeholder="Ficha cadastral Caixa" required />
              <Field label="Descrição" name="description" placeholder="Quando usar este modelo" />
            </div>

            <div>
              <Label htmlFor="template-file">Arquivo PDF</Label>
              <input
                id="template-file"
                name="file"
                type="file"
                accept="application/pdf"
                required
                className="h-10 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink file:mr-3 file:rounded file:border-0 file:bg-surface-muted file:px-2 file:py-1 file:text-sm file:text-ink"
              />
            </div>

            {uploadState.error ? (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-status-reprovado">
                {uploadState.error}
              </p>
            ) : null}
            {uploadState.ok ? (
              <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-status-aprovado">
                {uploadState.ok}
              </p>
            ) : null}

            <div>
              <SubmitButton>Enviar modelo</SubmitButton>
            </div>
          </form>
        </CardBody>
      </Card>

      {templates.map((template) => (
        <Card key={template.id}>
          <CardHeader
            title={template.name}
            description={
              template.description ??
              `${template.detectedFields.length} campo(s) no PDF · ${Object.keys(template.fieldMap).length} mapeado(s)`
            }
            action={
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setAberto(aberto === template.id ? null : template.id)}
                >
                  {aberto === template.id ? "Fechar" : "Mapear campos"}
                </Button>
                <button
                  type="button"
                  aria-label={`Excluir ${template.name}`}
                  disabled={pending}
                  onClick={() => startTransition(() => void removeTemplate(template.id))}
                  className="rounded-md p-1.5 text-ink-muted transition hover:bg-surface-muted hover:text-status-reprovado disabled:opacity-40"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            }
          />

          {aberto === template.id ? (
            <MapeamentoForm template={template} opcoes={opcoes} />
          ) : (
            <CardBody className="flex items-center gap-2 text-sm text-ink-muted">
              <FileText className="size-4" aria-hidden />
              {Object.keys(template.fieldMap).length === 0
                ? "Nenhum campo mapeado ainda — o formulário sairia em branco."
                : "Disponível na tela do processo, em Formulários."}
            </CardBody>
          )}
        </Card>
      ))}
    </div>
  );
}

function MapeamentoForm({
  template,
  opcoes,
}: {
  template: TemplateRow;
  opcoes: { value: string; label: string }[];
}) {
  const [state, action] = useActionState<TemplateState, FormData>(
    saveFieldMap.bind(null, template.id),
    {},
  );

  return (
    <CardBody>
      <form action={action} className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">
          Para cada campo do PDF, escolha qual dado do sistema deve entrar nele. O que ficar sem
          escolha sai em branco no formulário.
        </p>

        <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
          {template.detectedFields.map((campo) => (
            <li key={campo} className="grid grid-cols-2 items-center gap-3">
              <code className="truncate text-xs text-ink" title={campo}>
                {campo}
              </code>
              <Select
                aria-label={`Dado para o campo ${campo}`}
                name={`campo:${campo}`}
                className="h-9 text-sm"
                options={opcoes}
                defaultValue={template.fieldMap[campo] ?? ""}
                placeholder="— deixar em branco —"
              />
            </li>
          ))}
        </ul>

        {state.error ? (
          <p role="alert" className="text-sm text-status-reprovado">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p role="status" className="text-sm text-status-aprovado">
            {state.ok}
          </p>
        ) : null}

        <div>
          <SubmitButton size="sm">Salvar mapeamento</SubmitButton>
        </div>
      </form>
    </CardBody>
  );
}
