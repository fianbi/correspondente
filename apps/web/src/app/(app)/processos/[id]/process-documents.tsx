"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, Printer } from "lucide-react";
import { parametroDe, type Pergunta } from "@/lib/formularios";

/**
 * Saídas em PDF do processo: o resumo e os formulários do banco já mapeados.
 * Chamava "Documentos" e se confundia com a aba de anexos; agora diz o que faz.
 *
 * São links diretos para rotas de servidor — abrir em aba nova é o
 * comportamento que o operador espera de documento para impressão. Formulário
 * com perguntas (cartão? qual programa?) mostra antes uma telinha com elas, e
 * as respostas vão na URL do PDF.
 */
interface TemplateItem {
  id: string;
  name: string;
  perguntas: Pergunta[];
}

export function ProcessDocuments({
  processId,
  templates,
}: {
  processId: string;
  templates: TemplateItem[];
}) {
  const [perguntando, setPerguntando] = useState<TemplateItem | null>(null);

  return (
    <details className="relative">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-surface-muted">
        <Printer className="size-4" aria-hidden />
        Gerar PDF
        <ChevronDown className="size-3.5 text-ink-muted" aria-hidden />
      </summary>

      <div className="absolute right-0 z-10 mt-1 w-72 rounded-md border border-line bg-white py-1 shadow-lg">
        {perguntando ? (
          <Perguntas
            processId={processId}
            template={perguntando}
            onVoltar={() => setPerguntando(null)}
          />
        ) : (
          <>
            <a
              href={`/processos/${processId}/resumo.pdf`}
              target="_blank"
              rel="noopener"
              className="block px-3 py-2 text-sm text-ink hover:bg-surface-muted"
            >
              Resumo do processo
            </a>

            {templates.length > 0 ? (
              <>
                <p className="border-t border-line px-3 pt-2 pb-1 text-xs font-medium text-ink-muted">
                  Formulários do banco
                </p>
                {templates.map((template) =>
                  template.perguntas.length > 0 ? (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setPerguntando(template)}
                      className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-surface-muted"
                    >
                      {template.name}…
                    </button>
                  ) : (
                    <a
                      key={template.id}
                      href={`/processos/${processId}/formularios/${template.id}.pdf`}
                      target="_blank"
                      rel="noopener"
                      className="block px-3 py-2 text-sm text-ink hover:bg-surface-muted"
                    >
                      {template.name}
                    </a>
                  ),
                )}
              </>
            ) : (
              <p className="border-t border-line px-3 py-2 text-xs text-ink-muted">
                Nenhum formulário mapeado. Configure em Formulários, no menu lateral.
              </p>
            )}
          </>
        )}
      </div>
    </details>
  );
}

function Perguntas({
  processId,
  template,
  onVoltar,
}: {
  processId: string;
  template: TemplateItem;
  onVoltar: () => void;
}) {
  return (
    <form
      method="get"
      action={`/processos/${processId}/formularios/${template.id}.pdf`}
      target="_blank"
      className="flex flex-col gap-3 px-3 py-2"
    >
      <button
        type="button"
        onClick={onVoltar}
        className="inline-flex items-center gap-1 self-start text-xs text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
        Voltar
      </button>
      <p className="text-sm font-medium text-ink">{template.name}</p>

      {template.perguntas.map((pergunta) => {
        if (pergunta.tipo === "texto") {
          return (
            <label key={pergunta.campo} className="flex flex-col gap-1 text-sm text-ink">
              {pergunta.campo}
              <input
                name={parametroDe.texto(pergunta.campo)}
                className="h-9 rounded-md border border-line px-2 text-sm"
              />
            </label>
          );
        }
        if (pergunta.tipo === "marcar") {
          return (
            <label key={pergunta.campo} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name={parametroDe.marcar(pergunta.campo)} value="1" />
              {pergunta.campo}
            </label>
          );
        }
        return (
          <fieldset key={pergunta.grupo} className="flex flex-col gap-1">
            <legend className="mb-1 text-xs font-medium text-ink-muted">
              {pergunta.grupo}
              {pergunta.obrigatoria ? "" : " (opcional)"}
            </legend>
            {pergunta.opcoes.map((opcao) => (
              <label key={opcao} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name={parametroDe.opcao(pergunta.grupo)}
                  value={opcao}
                  required={pergunta.obrigatoria}
                />
                {opcao}
              </label>
            ))}
          </fieldset>
        );
      })}

      <button
        type="submit"
        className="h-9 rounded-md bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
      >
        Gerar PDF
      </button>
    </form>
  );
}
