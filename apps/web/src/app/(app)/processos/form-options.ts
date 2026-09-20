import "server-only";

import type { OrgContext } from "@corr/core";
import {
  listAgencies,
  listBanks,
  listBrokers,
  listOrgMembers,
  listPeople,
  listRealEstateAgencies,
} from "@corr/db";
import type { ProcessFormOptions } from "./process-form";

/**
 * Carrega de uma vez tudo que os `<select>` do formulário de processo
 * precisam. Fica separado da página para o formulário de criar e o de editar
 * não divergirem em quais opções mostram.
 */
export async function loadProcessFormOptions(ctx: OrgContext): Promise<ProcessFormOptions> {
  const [people, banks, agencies, brokers, realEstateAgencies, members] = await Promise.all([
    listPeople(ctx, { limit: 200 }),
    listBanks(),
    listAgencies(ctx),
    listBrokers(ctx),
    listRealEstateAgencies(ctx),
    listOrgMembers(ctx),
  ]);

  return {
    people: people.rows.map((person) => ({
      id: person.id,
      fullName: person.fullName,
      cpf: person.cpf,
    })),
    banks: banks.map((bank) => ({ id: bank.id, shortName: bank.shortName })),
    agencies: agencies.map((agency) => ({
      id: agency.id,
      name: agency.name,
      number: agency.number,
      bankShortName: agency.bankShortName,
    })),
    brokers: brokers.map((broker) => ({ id: broker.id, name: broker.name })),
    realEstateAgencies: realEstateAgencies.map((agency) => ({ id: agency.id, name: agency.name })),
    members: members.map((member) => ({ userId: member.userId, fullName: member.fullName })),
  };
}
