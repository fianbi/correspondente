import "server-only";

import type { OrgContext } from "@corr/core";
import { listBrokers, listGrossIncomes, listPeople, listRealEstateAgencies } from "@corr/db";
import type { ProcessFormOptions } from "./process-form";

/**
 * Opções da abertura de processo: pessoas (com a renda, para o operador ver
 * quem vai ser o principal) e os parceiros já cadastrados.
 */
export async function loadProcessFormOptions(ctx: OrgContext): Promise<ProcessFormOptions> {
  const [people, brokers, realEstateAgencies] = await Promise.all([
    listPeople(ctx, { limit: 200 }),
    listBrokers(ctx),
    listRealEstateAgencies(ctx),
  ]);
  const incomes = await listGrossIncomes(
    ctx,
    people.rows.map((person) => person.id),
  );

  return {
    people: people.rows.map((person) => ({
      id: person.id,
      fullName: person.fullName,
      cpf: person.cpf,
      grossIncomeCents: incomes.get(person.id) ?? 0,
    })),
    brokers: brokers.map((broker) => ({ id: broker.id, name: broker.name })),
    realEstateAgencies: realEstateAgencies.map((agency) => ({ id: agency.id, name: agency.name })),
  };
}
