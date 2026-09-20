/**
 * Dinheiro trafega e é guardado em **centavos inteiros** (bigint no banco).
 * Float em valor de financiamento acumula erro de arredondamento e, em cálculo
 * de comissão, isso vira divergência de centavos que ninguém consegue explicar.
 */
export type Cents = number;

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(cents: Cents | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return BRL.format(cents / 100);
}

/**
 * Lê valor digitado ou capturado de tela de banco no formato pt-BR
 * ("R$ 1.234,56", "1.234,56", "1234,56") e devolve centavos.
 * Retorna `null` quando não há número reconhecível.
 */
export function parseBRL(value: string | number | null | undefined): Cents | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) : null;

  const cleaned = value.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;

  // pt-BR: ponto é separador de milhar, vírgula é decimal.
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

/** Valor sem símbolo, pronto para digitar em campo de portal ("1234,56"). */
export function toPlainBRL(cents: Cents | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Percentual guardado em basis points (1,25% = 125) pelo mesmo motivo. */
export type BasisPoints = number;

export function formatPercent(bps: BasisPoints | null | undefined): string {
  if (bps === null || bps === undefined) return "—";
  return `${(bps / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
}

export function parsePercent(value: string | number | null | undefined): BasisPoints | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) : null;
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}
