import { onlyDigits } from "./document";

/**
 * Canônico: só dígitos com DDD (10 ou 11 posições), sem o +55. O WhatsApp e a
 * captura de tela chegam em formatos variados; guardar normalizado evita
 * duplicar pessoa por causa de parêntese.
 */
export function normalizePhone(value: string): string {
  let digits = onlyDigits(value);
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  return digits;
}

export function formatPhone(value: string): string {
  const d = normalizePhone(value);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value;
}

export function isValidPhone(value: string): boolean {
  const d = normalizePhone(value);
  return (d.length === 10 || d.length === 11) && !/^(\d)\1+$/.test(d);
}
