"use client";

import { useState } from "react";
import { formatBRL } from "@corr/core";
import { cn } from "@/lib/utils";

/**
 * Barras horizontais com rótulo no eixo e valor ao final de cada barra.
 *
 * Uma cor só, de propósito: a identidade de cada linha vem do texto do rótulo,
 * não da cor. Pintar cada barra de um tom diferente não acrescenta informação
 * nenhuma e cria um problema de daltonismo que não precisava existir.
 *
 * Os números ficam sempre visíveis em texto — quem lê nunca depende de medir a
 * barra no olho, e a leitura funciona igual em impressão preto e branco.
 */
export interface BarItem {
  label: string;
  quantity: number;
  totalCents: number;
}

export function BarList({
  items,
  measure = "quantity",
  emptyMessage = "Nenhum processo.",
}: {
  items: BarItem[];
  /** O que a barra representa. O outro número aparece no detalhe. */
  measure?: "quantity" | "value";
  emptyMessage?: string;
}) {
  const [destacado, setDestacado] = useState<string | null>(null);

  const valorDe = (item: BarItem) =>
    measure === "quantity" ? item.quantity : item.totalCents;

  const maximo = Math.max(...items.map(valorDe), 1);
  const total = items.reduce((soma, item) => soma + valorDe(item), 0);

  if (items.length === 0 || total === 0) {
    return <p className="px-5 py-6 text-sm text-ink-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5 px-5 py-4">
      {items.map((item) => {
        const valor = valorDe(item);
        const proporcao = Math.max((valor / maximo) * 100, valor > 0 ? 2 : 0);
        const ativo = destacado === item.label;

        return (
          <li
            key={item.label}
            onMouseEnter={() => setDestacado(item.label)}
            onMouseLeave={() => setDestacado(null)}
            onFocus={() => setDestacado(item.label)}
            onBlur={() => setDestacado(null)}
            tabIndex={0}
            className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-md outline-none focus-visible:outline-2 focus-visible:outline-brand-500/40"
          >
            <span className="truncate text-sm text-ink" title={item.label}>
              {item.label}
            </span>

            {/* Trilho recessivo, barra fina com a ponta arredondada e ancorada
                na base — a leitura é do comprimento, não do enfeite. */}
            <span className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <span
                className={cn(
                  "block h-full rounded-full transition-[width,background-color]",
                  ativo ? "bg-brand-700" : "bg-brand-500",
                )}
                style={{ width: `${proporcao}%` }}
              />
            </span>

            <span className="tabular shrink-0 text-right text-sm font-medium text-ink">
              {measure === "quantity" ? valor : formatBRL(valor)}
            </span>

            {ativo ? (
              <span className="col-span-3 -mt-1 text-xs text-ink-muted">
                {measure === "quantity"
                  ? `${formatBRL(item.totalCents)} em financiamento`
                  : `${item.quantity} processo(s)`}
                {" · "}
                {Math.round((valor / total) * 100)}% do total
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
