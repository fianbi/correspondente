export * from "./client";
export * from "./env";
export * from "./repositories/index";

/**
 * As tabelas ficam atrás do namespace `schema` de propósito: quem consome o
 * pacote (o app web) usa os repositórios, que exigem `OrgContext`. Expor as
 * tabelas soltas convidaria a montar query direto na página e a furar o
 * isolamento por tenant sem perceber.
 */
export * as schema from "./schema/index";

export type {
  Agency,
  Bank,
  Broker,
  NewOrg,
  NewPerson,
  NewPersonIncome,
  NewProcess,
  Org,
  OrgMember,
  Person,
  PersonIncome,
  Process,
  ProcessParticipant,
  Profile,
  RealEstateAgency,
  Flow,
  FlowStage,
  ProcessEvent,
  ProcessFieldValue,
  ProcessStageState,
  AccessLink,
  Document,
  NewDocument,
  Pendency,
  ApiToken,
  FormTemplate,
  SiteMapping,
} from "./schema/index";
