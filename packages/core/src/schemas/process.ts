import { z } from "zod";
import {
  AMORTIZATION_SYSTEMS,
  MODALITIES,
  PARTICIPANT_ROLES,
  PROCESS_STAGES,
  PROCESS_STATUSES,
} from "../domain/process";
import { optionalDate, optionalEnum, optionalInt, optionalMoney, optionalText } from "./helpers";

const uuidOrNull = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullish()
  .transform((value) => value ?? null)
  .refine((value) => value === null || z.uuid().safeParse(value).success, "Seleção inválida.");

export const processInputSchema = z.object({
  /** Proponente principal: o processo não existe sem alguém financiando. */
  personId: z.uuid("Selecione o proponente."),

  stage: z.enum(PROCESS_STAGES).default("cadastro"),
  status: z.enum(PROCESS_STATUSES).default("em_aberto"),

  bankId: uuidOrNull,
  agencyId: uuidOrNull,
  modality: optionalEnum(MODALITIES),
  amortizationSystem: optionalEnum(AMORTIZATION_SYSTEMS),
  indexer: optionalText,

  contractNumber: optionalText,
  proposalNumber: optionalText,

  propertyValueCents: optionalMoney,
  financedValueCents: optionalMoney,
  approvedValueCents: optionalMoney,
  subsidyCents: optionalMoney,
  fgtsCents: optionalMoney,
  termMonths: optionalInt,
  creditValidUntil: optionalDate,

  brokerId: uuidOrNull,
  realEstateAgencyId: uuidOrNull,
  assignedTo: uuidOrNull,

  propertyAddress: optionalText,
  propertyRegistration: optionalText,
  notes: optionalText,
});

export type ProcessInput = z.infer<typeof processInputSchema>;

export const processParticipantInputSchema = z.object({
  personId: z.uuid("Selecione a pessoa."),
  role: z.enum(PARTICIPANT_ROLES),
});

export const moveStageInputSchema = z.object({
  processId: z.uuid(),
  stage: z.enum(PROCESS_STAGES),
});
