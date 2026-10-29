import { z } from "zod";
import { parseBRL } from "../format/currency";
import { onlyDigits } from "../format/document";

/**
 * Helpers para schemas que recebem `FormData`: tudo chega como string, e
 * campo vazio precisa virar `null` (não `""`), senão o banco guarda string
 * vazia onde deveria haver ausência de dado.
 */

export const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullish()
  .transform((value) => value ?? null);

export const optionalDigits = z
  .string()
  .trim()
  .transform((value) => {
    const digits = onlyDigits(value);
    return digits === "" ? null : digits;
  })
  .nullish()
  .transform((value) => value ?? null);

/** Data no formato do input HTML (`AAAA-MM-DD`), guardada como string. */
export const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Data inválida.")
  .transform((value) => (value === "" ? null : value))
  .nullish()
  .transform((value) => value ?? null);

/** Aceita "R$ 1.234,56" ou "1234,56" e guarda centavos inteiros. */
export const optionalMoney = z
  .union([z.string(), z.number()])
  .transform((value) => parseBRL(value))
  .nullish()
  .transform((value) => value ?? null);

export const optionalInt = z
  .union([z.string(), z.number()])
  .transform((value) => {
    if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  })
  .nullish()
  .transform((value) => value ?? null);

export const optionalEmail = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value.toLowerCase()))
  .nullish()
  .transform((value) => value ?? null)
  .refine(
    (value) => value === null || z.string().email().safeParse(value).success,
    "E-mail inválido.",
  );

/** `<select>` vazio vira `null` em vez de quebrar o enum. */
export function optionalEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullish()
    .transform((value) => value ?? null)
    .refine(
      (value) => value === null || (values as readonly string[]).includes(value),
      "Opção inválida.",
    )
    .transform((value) => value as T[number] | null);
}

/**
 * Sim/não opcional. Chega como `"true"`/`"false"` (select Sim/Não da web,
 * marcação lida do portal) ou booleano; vazio é "não respondido" (`null`),
 * que não é o mesmo que "não".
 */
export const optionalBoolean = z
  .union([z.boolean(), z.string()])
  .transform((value, ctx) => {
    if (typeof value === "boolean") return value;
    const texto = value.trim().toLowerCase();
    if (texto === "") return null;
    if (texto === "true" || texto === "sim") return true;
    if (texto === "false" || texto === "nao" || texto === "não") return false;
    ctx.addIssue({ code: "custom", message: "Opção inválida." });
    return z.NEVER;
  })
  .nullish()
  .transform((value) => value ?? null);
