"use client";

import Link from "next/link";
import { useTransition } from "react";
import { PROCESS_STAGES, PROCESS_STAGE_LABELS, formatBRL, formatCpf, type ProcessStage } from "@corr/core";
import type { StageColumn } from "@corr/db";
import { StatusBadge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { moveStage } from "./actions";

const STAGE_OPTIONS = PROCESS_STAGES.map((stage) => ({
  value: stage,
  label: PROCESS_STAGE_LABELS[stage],
}));

/**
 * Kanban por fase. A troca de fase é um `<select>` em cada card, não
 * arrastar-e-soltar: funciona no celular, é acessível por teclado e não perde
 * o movimento se a conexão cair no meio — o operador acompanha processo em pé
 * na agência, não só sentado na mesa.
 */
export function KanbanBoard({ columns }: { columns: StageColumn[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((column) => (
        <section
          key={column.stage}
          className="flex w-72 shrink-0 flex-col rounded-lg border border-line bg-surface-muted/60"
          aria-label={PROCESS_STAGE_LABELS[column.stage]}
        >
          <header className="flex items-center justify-between border-b border-line px-3 py-2">
            <h2 className="text-sm font-semibold text-ink">
              {PROCESS_STAGE_LABELS[column.stage]}
            </h2>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-ink-muted">
              {column.processes.length}
            </span>
          </header>

          <div className="flex flex-col gap-2 p-2">
            {column.processes.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-ink-muted">Nenhum processo</p>
            ) : (
              column.processes.map((process) => (
                <article
                  key={process.id}
                  className="rounded-md border border-line bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/processos/${process.id}`}
                      className="text-sm font-medium text-ink hover:text-brand-600 hover:underline"
                    >
                      #{process.number} {process.personName}
                    </Link>
                    <StatusBadge status={process.status} />
                  </div>

                  <p className="mt-1 text-xs text-ink-muted">{formatCpf(process.personCpf)}</p>
                  <p className="tabular mt-1 text-sm font-medium text-ink">
                    {formatBRL(process.financedValueCents)}
                  </p>
                  {process.bankShortName ? (
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {process.bankShortName}
                      {process.agencyName ? ` · ${process.agencyName}` : ""}
                    </p>
                  ) : null}

                  <Select
                    aria-label={`Mover processo ${process.number} de fase`}
                    className="mt-2 h-8 text-xs"
                    placeholder={null}
                    options={STAGE_OPTIONS}
                    value={column.stage}
                    disabled={pending}
                    onChange={(event) => {
                      const stage = event.target.value as ProcessStage;
                      startTransition(() => void moveStage(process.id, stage));
                    }}
                  />
                </article>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
