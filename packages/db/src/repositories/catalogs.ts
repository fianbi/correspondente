import { type OrgContext, NotFoundError } from "@corr/core";
import { and, asc, eq } from "drizzle-orm";
import { getAdminDb, withOrg } from "../client";
import { agencies, banks, brokers, realEstateAgencies } from "../schema/catalogs";

/**
 * Bancos são referência global e não passam por `withOrg`: a policy de RLS
 * libera leitura para todos e a escrita fica só na conexão administrativa.
 */
export async function listBanks() {
  return getAdminDb().select().from(banks).orderBy(asc(banks.shortName));
}

export async function listAgencies(ctx: OrgContext) {
  return withOrg(ctx, (tx) =>
    tx
      .select({
        id: agencies.id,
        number: agencies.number,
        name: agencies.name,
        city: agencies.city,
        uf: agencies.uf,
        bankId: agencies.bankId,
        bankShortName: banks.shortName,
      })
      .from(agencies)
      .innerJoin(banks, eq(banks.id, agencies.bankId))
      .where(eq(agencies.orgId, ctx.orgId))
      .orderBy(asc(banks.shortName), asc(agencies.number)),
  );
}

export interface AgencyInput {
  bankId: string;
  number: string;
  name: string;
  city?: string | null;
  uf?: string | null;
  email?: string | null;
  phone?: string | null;
}

export async function createAgency(ctx: OrgContext, input: AgencyInput) {
  return withOrg(ctx, async (tx) => {
    const [created] = await tx
      .insert(agencies)
      .values({ ...input, orgId: ctx.orgId })
      .returning();
    if (!created) throw new Error("Falha ao cadastrar a agência.");
    return created;
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
