"use client";

import { useActionState, useState, useTransition } from "react";
import { FileText, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { addReadyTemplate, removeTemplate, saveTemplateInfo, type TemplateState } from "./actions";

export interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  detectedFields: string[];
  fieldMap: Record<string, string>;
}

export interface ProntoRow {
  chave: string;
  nome: string;
  descricao: string;
  adicionado: boolean;
}

export function TemplatesPanel({
  templates,
  prontos,
  canManage,
}: {
  templates: TemplateRow[];
  prontos: ProntoRow[];
  /** Admin e Proprietário adicionam, editam e tiram modelos; os demais só veem. */
  canManage: boolean;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [prontoState, setProntoState] = useState<TemplateState>({});

  return (
    <div className="flex flex-col gap-6">
      {!canManage ? (
        <p className="text-sm text-ink-muted">
          Só administradores adicionam ou mudam modelos.{" "}
          {templates.length > 0
            ? "Os modelos abaixo já estão disponíveis na tela do processo, em Gerar PDF."
            : "Nenhum modelo foi adicionado ainda."}
        </p>
      ) : null}

      {canManage && prontos.length > 0 ? (
        <Card>
          <CardHeader
            title="Modelos prontos"
            description="Formulários do banco já preparados: o que vem do cadastro é preenchido sozinho e o resto é perguntado na hora de gerar. Atualizar traz a versão mais nova, mantendo nome e descrição."
          />
          <CardBody className="flex flex-col gap-3">
            {prontos.map((pronto) => (
              <div key={pronto.chave} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{pronto.nome}</p>
                  <p className="text-xs text-ink-muted">{pronto.descricao}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => setProntoState(await addReadyTemplate(pronto.chave)))
                  }
                >
                  {pronto.adicionado ? "Atualizar" : "Adicionar"}
                </Button>
              </div>
            ))}
            {prontoState.error ? (
              <p role="alert" className="text-sm text-status-reprovado">
                {prontoState.error}
              </p>
            ) : null}
            {prontoState.ok ? (
              <p role="status" className="text-sm text-status-aprovado">
                {prontoState.ok}
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {templates.map((template) => (
        <Card key={template.id}>
          <CardHeader
            title={template.name}
            description={template.description ?? undefined}
            action={
              canManage ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setAberto(aberto === template.id ? null : template.id)}
                  >
                    {aberto === template.id ? "Fechar" : "Editar"}
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
              ) : undefined
            }
          />

          {aberto === template.id ? (
            <InfoForm template={template} />
          ) : (
            <CardBody className="flex items-center gap-2 text-sm text-ink-muted">
              <FileText className="size-4" aria-hidden />
              Disponível na tela do processo, em Gerar PDF.
            </CardBody>
          )}
        </Card>
      ))}
    </div>
  );
}

function InfoForm({ template }: { template: TemplateRow }) {
  const [state, action] = useActionState<TemplateState, FormData>(
    saveTemplateInfo.bind(null, template.id),
    {},
  );

  return (
    <CardBody>
      <form action={action} className="flex flex-col gap-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" name="name" defaultValue={template.name} required />
          <Field
            label="Descrição"
            name="description"
            defaultValue={template.description ?? ""}
            placeholder="Quando usar este modelo"
          />
        </div>

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
          <SubmitButton size="sm">Salvar</SubmitButton>
        </div>
      </form>
    </CardBody>
  );
}
