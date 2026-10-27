import { z } from "zod";
import { isValidCpf, normalizeCpf } from "../format/document";
import { normalizePhone } from "../format/phone";
import {
  EDUCATION_LEVELS,
  HOUSING_SITUATIONS,
  ID_DOCUMENT_TYPES,
  INCOME_KINDS,
  INCOME_PROOF_TYPES,
  MARITAL_STATUSES,
  NATIONALITIES,
  PROPERTY_TYPES,
  SEXES,
  UFS,
  requiresSpouse,
} from "../domain/person";
import {
  optionalDate,
  optionalDigits,
  optionalEmail,
  optionalEnum,
  optionalInt,
  optionalMoney,
  optionalText,
} from "./helpers";

export const cpfSchema = z
  .string()
  .trim()
  .transform(normalizeCpf)
  .refine((value) => isValidCpf(value), "CPF inválido.");

export const personInputSchema = z
  .object({
    cpf: cpfSchema,
    fullName: z.string().trim().min(3, "Informe o nome completo."),
    shortName: optionalText,
    birthDate: optionalDate,
    sex: optionalEnum(SEXES),
    nationality: optionalEnum(NATIONALITIES),
    birthUf: optionalEnum(UFS),
    birthCity: optionalText,
    motherName: optionalText,
    fatherName: optionalText,
    educationLevel: optionalEnum(EDUCATION_LEVELS),
    pis: optionalDigits,

    docType: optionalEnum(ID_DOCUMENT_TYPES),
    docNumber: optionalText,
    docIssuer: optionalText,
    docIssuerUf: optionalEnum(UFS),
    docIssuedAt: optionalDate,
    docValidUntil: optionalDate,
    /** Só CNH. */
    docFirstLicenseDate: optionalDate,
    /** Só passaporte. */
    docIssuerCountry: optionalText,
    /** Só nacionalidade estrangeira. */
    nationalityCountry: optionalText,

    maritalStatus: optionalEnum(MARITAL_STATUSES),
    spouseCpf: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : normalizeCpf(value)))
      .nullish()
      .transform((value) => value ?? null)
      .refine((value) => value === null || isValidCpf(value), "CPF do cônjuge inválido."),
    spouseName: optionalText,

    email: optionalEmail,
    phone: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : normalizePhone(value)))
      .nullish()
      .transform((value) => value ?? null),

    zipCode: optionalDigits,
    streetType: optionalText,
    street: optionalText,
    streetNumber: optionalText,
    complement: optionalText,
    district: optionalText,
    city: optionalText,
    uf: optionalEnum(UFS),
    propertyType: optionalEnum(PROPERTY_TYPES),
    housingSituation: optionalEnum(HOUSING_SITUATIONS),
    residenceProofMonth: optionalInt,
    residenceProofYear: optionalInt,

    dependentsCount: optionalInt,
    rentCents: optionalMoney,
    condoFeeCents: optionalMoney,
    alimonyCents: optionalMoney,

    notes: optionalText,
  })
  .superRefine((value, ctx) => {
    // O banco recusa o cadastro de casado sem cônjuge; barrar aqui evita
    // descobrir isso só na hora de preencher o portal.
    if (value.maritalStatus && requiresSpouse(value.maritalStatus) && !value.spouseName) {
      ctx.addIssue({
        code: "custom",
        path: ["spouseName"],
        message: "Informe o nome do cônjuge/companheiro.",
      });
    }
    if (value.residenceProofMonth !== null && (value.residenceProofMonth < 1 || value.residenceProofMonth > 12)) {
      ctx.addIssue({ code: "custom", path: ["residenceProofMonth"], message: "Mês inválido." });
    }
    // O portal aceita até dois dígitos.
    if (value.dependentsCount !== null && (value.dependentsCount < 0 || value.dependentsCount > 99)) {
      ctx.addIssue({ code: "custom", path: ["dependentsCount"], message: "Número inválido." });
    }
    // Espelha o que o portal exige em cada variação, para o operador descobrir
    // o que falta aqui e não no meio do preenchimento da tela do banco.
    if (value.nationality === "estrangeiro" && !value.nationalityCountry) {
      ctx.addIssue({
        code: "custom",
        path: ["nationalityCountry"],
        message: "Informe o país de nacionalidade.",
      });
    }
  });

export type PersonInput = z.infer<typeof personInputSchema>;

export const personIncomeInputSchema = z.object({
  kind: z.enum(INCOME_KINDS),
  sourceName: optionalText,
  sourceDocument: optionalDigits,
  occupation: optionalText,
  startDate: optionalDate,
  grossCents: optionalMoney,
  netCents: optionalMoney,
  incomeTaxCents: optionalMoney,
  proofType: optionalEnum(INCOME_PROOF_TYPES),
  proofMonth: optionalInt,
  proofYear: optionalInt,
  previousJobYears: optionalInt,
  previousJobMonths: optionalInt,
  notes: optionalText,
});

export type PersonIncomeInput = z.infer<typeof personIncomeInputSchema>;
