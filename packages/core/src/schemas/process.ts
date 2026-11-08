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
import { cpfSchema } from "./person";

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
      .default([]),
    participants: z.array(
      z.object({ personId: z.uuid("Selecione a pessoa."), role: z.enum(OTHER_PARTICIPANT_ROLES) }),
    ),
    brokerId: uuidOrNull,
    newBrokerName: optionalText,
    realEstateAgencyId: uuidOrNull,
    newRealEstateAgencyName: optionalText,
    /** Simulação de onde o processo nasceu, quando nasceu de uma. */
    simulationId: uuidOrNull,
    /** Cliente da simulação ainda sem cadastro: entra como proponente. */
    newPerson: z
      .object({ cpf: cpfSchema, fullName: z.string().trim().min(1, "Informe o nome.") })
      .nullish()
      .transform((value) => value ?? null),
  })
  .refine((input) => input.proponentIds.length > 0 || input.newPerson !== null, {
    message: "Informe pelo menos um proponente.",
    path: ["proponentIds"],
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

/** "sim"/"nao"/vazio do formulário para booleano ou não respondido. */
const simNao = z
  .enum(["sim", "nao", ""])
  .optional()
  .transform((value) => (value === "sim" ? true : value === "nao" ? false : null));

export const simulationScenarioSchema = z.object({
  financedValueCents: optionalMoney,
  termMonths: optionalInt,
  amortization: optionalEnum(AMORTIZATION_SYSTEMS),
  interestRate: optionalText,
  firstInstallmentCents: optionalMoney,
  subsidyCents: optionalMoney,
  chosen: z.boolean(),
});

/**
 * Simulação: o cliente ainda não tem cadastro, então basta nome e telefone.
 * As sete perguntas são as que o escritório faz para simular.
 */
export const simulationInputSchema = z.object({
  clientName: z.string().trim().min(1, "Informe o nome do cliente."),
  clientPhone: optionalText,
  oldestBirthDate: optionalDate,
  familyIncomeCents: optionalMoney,
  fgtsThreeYears: simNao,
  multipleBuyers: simNao,
  propertyValueCents: optionalMoney,
  hadSubsidy: simNao,
  ownsProperty: simNao,
  scenarios: z.array(simulationScenarioSchema),
  notes: optionalText,
});

export type SimulationInput = z.infer<typeof simulationInputSchema>;

export const processParticipantInputSchema = z.object({
  personId: z.uuid("Selecione a pessoa."),
  role: z.enum(PARTICIPANT_ROLES),
});

export const moveStageInputSchema = z.object({
  processId: z.uuid(),
  stage: z.enum(PROCESS_STAGES),
});
