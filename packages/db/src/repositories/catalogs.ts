import { type OrgContext, DomainError, NotFoundError } from "@corr/core";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { getAdminDb, withOrg, type Tx } from "../client";
import { agencies, banks, brokers, realEstateAgencies } from "../schema/catalogs";
import { processes } from "../schema/processes";

/**
 * Bancos são referência global e não passam por `withOrg`: a policy de RLS
 * libera leitura para todos e a escrita fica só na conexão administrativa.
 */
export async function listBanks() {
  return getAdminDb().select().from(banks).orderBy(asc(banks.shortName));
}

/** Nome que o sistema dá à agência cadastrada só pelo número. */
export function nomeProvisorioDaAgencia(number: string) {
  return `Agência ${number}`;
}

/** Cadastro de agências do escritório, com quantos processos usam cada uma. */
export async function listAgencies(ctx: OrgContext) {
  return withOrg(ctx, (tx) =>
    tx
      .select({
        id: agencies.id,
        number: agencies.number,
        name: agencies.name,
        city: agencies.city,
        uf: agencies.uf,
        email: agencies.email,
        phone: agencies.phone,
        bankId: agencies.bankId,
        bankShortName: banks.shortName,
        processCount: count(processes.id),
      })
      .from(agencies)
      .innerJoin(banks, eq(banks.id, agencies.bankId))
      .leftJoin(
        processes,
        and(eq(processes.agencyId, agencies.id), eq(processes.orgId, ctx.orgId)),
      )
      .where(eq(agencies.orgId, ctx.orgId))
      .groupBy(agencies.id, banks.shortName)
      .orderBy(asc(banks.shortName), asc(agencies.number)),
  );
}

export type AgencyListRow = Awaited<ReturnType<typeof listAgencies>>[number];

export interface AgencyInput {
  bankId: string;
  number: string;
  name: string;
  city?: string | null;
  uf?: string | null;
  email?: string | null;
  phone?: string | null;
}

const MENSAGEM_NUMERO_REPETIDO = "Já existe uma agência com esse número neste banco.";

async function numeroJaUsado(
  tx: Tx,
  ctx: OrgContext,
  input: { bankId: string; number: string },
  exceto?: string,
) {
  const [existing] = await tx
    .select({ id: agencies.id })
    .from(agencies)
    .where(
      and(
        eq(agencies.orgId, ctx.orgId),
        eq(agencies.bankId, input.bankId),
        eq(agencies.number, input.number),
        exceto ? ne(agencies.id, exceto) : undefined,
      ),
    )
    .limit(1);
  return Boolean(existing);
}

export async function createAgency(ctx: OrgContext, input: AgencyInput) {
  return withOrg(ctx, async (tx) => {
    if (await numeroJaUsado(tx, ctx, input)) throw new DomainError(MENSAGEM_NUMERO_REPETIDO, "agencia_repetida", 409);
    const [created] = await tx
      .insert(agencies)
      .values({ ...input, orgId: ctx.orgId })
      .returning();
    if (!created) throw new Error("Falha ao cadastrar a agência.");
    return created;
  });
}

export async function updateAgency(ctx: OrgContext, agencyId: string, input: AgencyInput) {
  return withOrg(ctx, async (tx) => {
    if (await numeroJaUsado(tx, ctx, input, agencyId)) {
      throw new DomainError(MENSAGEM_NUMERO_REPETIDO, "agencia_repetida", 409);
    }
    const [updated] = await tx
      .update(agencies)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(agencies.orgId, ctx.orgId), eq(agencies.id, agencyId)))
      .returning();
    if (!updated) throw new NotFoundError("Agência");
    return updated;
  });
}

/**
 * Exclui a agência só se nenhum processo a usa: apagar uma agência em uso
 * deixaria esses processos sem agência (e o formulário da Caixa sem ela).
 */
export async function deleteAgency(ctx: OrgContext, agencyId: string) {
  return withOrg(ctx, async (tx) => {
    const [uso] = await tx
      .select({ total: count() })
      .from(processes)
      .where(and(eq(processes.orgId, ctx.orgId), eq(processes.agencyId, agencyId)));
    const total = uso?.total ?? 0;
    if (total > 0) {
      throw new DomainError(
        total === 1
          ? "Um processo usa esta agência. Troque a agência dele antes de excluir."
          : `${total} processos usam esta agência. Troque a agência deles antes de excluir.`,
        "agencia_em_uso",
        409,
      );
    }
    const deleted = await tx
      .delete(agencies)
      .where(and(eq(agencies.orgId, ctx.orgId), eq(agencies.id, agencyId)))
      .returning({ id: agencies.id });
    if (deleted.length === 0) throw new NotFoundError("Agência");
  });
}

/**
 * Agência pelo número, cadastrando na hora se o escritório ainda não a tem.
 * É assim que o operador informa uma agência nova no processo: digita o
 * número (e, se quiser, nome e cidade) sem sair da tela.
 */
export async function findOrCreateAgency(
  ctx: OrgContext,
  input: { bankId: string; number: string; name?: string | null; city?: string | null },
) {
  return withOrg(ctx, async (tx) => {
    const [existing] = await tx
      .select({ id: agencies.id })
      .from(agencies)
      .where(
        and(
          eq(agencies.orgId, ctx.orgId),
          eq(agencies.bankId, input.bankId),
          eq(agencies.number, input.number),
        ),
      )
      .limit(1);
    if (existing) return existing.id;

    const [created] = await tx
      .insert(agencies)
      .values({
        orgId: ctx.orgId,
        bankId: input.bankId,
        number: input.number,
        name: input.name?.trim() || nomeProvisorioDaAgencia(input.number),
        city: input.city?.trim() || null,
      })
      .returning({ id: agencies.id });
    if (!created) throw new Error("Falha ao cadastrar a agência.");
    return created.id;
  });
}

export async function listRealEstateAgencies(ctx: OrgContext) {
  return withOrg(ctx, (tx) =>
    tx
      .select()
      .from(realEstateAgencies)
      .where(eq(realEstateAgencies.orgId, ctx.orgId))
      .orderBy(asc(realEstateAgencies.name)),
  );
}

export interface RealEstateAgencyInput {
  name: string;
  cnpj?: string | null;
  creci?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  uf?: string | null;
}

export async function createRealEstateAgency(ctx: OrgContext, input: RealEstateAgencyInput) {
  return withOrg(ctx, async (tx) => {
    const [created] = await tx
      .insert(realEstateAgencies)
      .values({ ...input, orgId: ctx.orgId })
      .returning();
    if (!created) throw new Error("Falha ao cadastrar a imobiliária.");
    return created;
  });
}

export async function listBrokers(ctx: OrgContext) {
  return withOrg(ctx, (tx) =>
    tx
      .select({
        id: brokers.id,
        name: brokers.name,
        cpf: brokers.cpf,
        creci: brokers.creci,
        email: brokers.email,
        phone: brokers.phone,
        realEstateAgencyId: brokers.realEstateAgencyId,
        realEstateAgencyName: realEstateAgencies.name,
      })
      .from(brokers)
      .leftJoin(realEstateAgencies, eq(realEstateAgencies.id, brokers.realEstateAgencyId))
      .where(eq(brokers.orgId, ctx.orgId))
      .orderBy(asc(brokers.name)),
  );
}

export interface BrokerInput {
  name: string;
  cpf?: string | null;
  creci?: string | null;
  email?: string | null;
  phone?: string | null;
  realEstateAgencyId?: string | null;
}

export async function createBroker(ctx: OrgContext, input: BrokerInput) {
  return withOrg(ctx, async (tx) => {
    const [created] = await tx
      .insert(brokers)
      .values({ ...input, orgId: ctx.orgId })
      .returning();
    if (!created) throw new Error("Falha ao cadastrar o corretor.");
    return created;
  });
}

export async function deleteBroker(ctx: OrgContext, brokerId: string) {
  return withOrg(ctx, async (tx) => {
    const deleted = await tx
      .delete(brokers)
      .where(and(eq(brokers.orgId, ctx.orgId), eq(brokers.id, brokerId)))
      .returning({ id: brokers.id });
    if (deleted.length === 0) throw new NotFoundError("Corretor");
  });
}
