"use client";

import { FileDown } from "lucide-react";

/**
 * Saídas em PDF do processo: o resumo e os formulários do banco já mapeados.
 *
 * São links diretos para rotas de servidor — abrir em aba nova é o
 * comportamento que o operador espera de documento para impressão.
 */
export function ProcessDocuments({
  processId,
  templates,
}: {
  processId: string;
  templates: { id: string; name: string }[];
}) {
  return (
    <details className="relative">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-surface-muted">
        <FileDown className="size-4" aria-hidden />
        Documentos
      </summary>

      <div className="absolute right-0 z-10 mt-1 w-64 rounded-md border border-line bg-white py-1 shadow-lg">
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
            {templates.map((template) => (
              <a
                key={template.id}
                href={`/processos/${processId}/formularios/${template.id}.pdf`}
                target="_blank"
                rel="noopener"
                className="block px-3 py-2 text-sm text-ink hover:bg-surface-muted"
              >
                {template.name}
              </a>
            ))}
          </>
        ) : (
          <p className="border-t border-line px-3 py-2 text-xs text-ink-muted">
            Nenhum formulário mapeado. Configure em Configurações → Formulários.
          </p>
        )}
      </div>
    </details>
  );
}
