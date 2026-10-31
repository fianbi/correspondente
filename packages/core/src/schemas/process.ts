import { z } from "zod";
import {
  AMORTIZATION_SYSTEMS,
  MODALITIES,
  OTHER_PARTICIPANT_ROLES,
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

/**
 * Abertura de processo: só modalidade e quem participa. O resto se preenche
 * etapa por etapa, que é onde cada alteração vira histórico.
 *
 * Corretor e imobiliária vêm do cadastro de parceiros: escolhe um existente
 * ou digita o nome de um novo, que é criado junto.
 */
export const processCreateSchema = z
  .object({
    modality: z.enum(MODALITIES, "Escolha a modalidade."),
    proponentIds: z
      .array(z.uuid("Selecione a pessoa."))
      .min(1, "Informe pelo menos um proponente."),
    participants: z.array(
      z.object({ personId: z.uuid("Selecione a pessoa."), role: z.enum(OTHER_PARTICIPANT_ROLES) }),
    ),
    brokerId: uuidOrNull,
    newBrokerName: optionalText,
    realEstateAgencyId: uuidOrNull,
    newRealEstateAgencyName: optionalText,
  })
  .refine((input) => new Set(input.proponentIds).size === input.proponentIds.length, {
    message: "A mesma pessoa aparece duas vezes como proponente.",
    path: ["proponentIds"],
  })
  .refine(
    (input) => input.participants.every((p) => !input.proponentIds.includes(p.personId)),
    { message: "Quem é proponente não precisa entrar de novo como participante.", path: ["participants"] },
  );

export type ProcessCreateInput = z.infer<typeof processCreateSchema>;

export const processParticipantInputSchema = z.object({
  personId: z.uuid("Selecione a pessoa."),
  role: z.enum(PARTICIPANT_ROLES),
});

export const moveStageInputSchema = z.object({
  processId: z.uuid(),
  stage: z.enum(PROCESS_STAGES),
});
