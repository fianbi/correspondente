/** Só os dígitos de uma string (CPF, CNPJ, telefone, CEP...). */
export const onlyDigits = (value: string): string => value.replace(/\D+/g, "");

/**
 * Confere os dígitos verificadores de CPF/CNPJ: para cada conjunto de pesos,
 * a soma ponderada módulo 11 tem que bater com o dígito na posição seguinte.
 */
function hasCheckDigits(digits: string, weightSets: number[][]): boolean {
  return weightSets.every((weights) => {
    const sum = weights.reduce((acc, weight, i) => acc + weight * Number(digits[i]), 0);
    const rest = sum % 11;
    const expected = rest < 2 ? 0 : 11 - rest;
    return Number(digits[weights.length]) === expected;
  });
}

const seq = (from: number, to: number): number[] => {
  const out: number[] = [];
  for (let n = from; n >= to; n--) out.push(n);
  return out;
};

const CPF_WEIGHTS = [seq(10, 2), seq(11, 2)];
const CNPJ_WEIGHTS = [
  [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
];

const allSameDigit = (digits: string): boolean => /^(\d)\1+$/.test(digits);

/** Valida CPF pelos dígitos verificadores. Aceita com ou sem máscara. */
export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || allSameDigit(digits)) return false;
  return hasCheckDigits(digits, CPF_WEIGHTS);
}

/** Valida CNPJ pelos dígitos verificadores. Aceita com ou sem máscara. */
export function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || allSameDigit(digits)) return false;
  return hasCheckDigits(digits, CNPJ_WEIGHTS);
}

/**
 * Forma canônica guardada no banco: só dígitos. A deduplicação de pessoas por
 * CPF depende disso — "123.456.789-09" e "12345678909" têm que colidir.
 */
export function normalizeCpf(value: string): string {
  return onlyDigits(value);
}

export function formatCpf(value: string): string {
  const d = onlyDigits(value);
  if (d.length !== 11) return value;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatCnpj(value: string): string {
  const d = onlyDigits(value);
  if (d.length !== 14) return value;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
