import type { OrgContext } from "@corr/core";
import { toCaixaAgencyValues, toCaixaIncomeValues, toCaixaValues } from "@corr/portal";
import { getPerson, listAgencies, listPersonIncomes } from "@corr/db";

/**
 * Dados de uma pessoa já traduzidos para os códigos do portal, que é o que a
 * extensão escreve na tela do banco.
 *
 * A tradução acontece aqui, no servidor, e não na extensão: assim o mapa de
 * códigos de cada banco fica num lugar só, versionado e testado.
 */
export async function dadosParaOPortal(
  ctx: OrgContext,
  personId: string,
  agencyId: string | null,
) {
  const [pessoa, rendas, agencias] = await Promise.all([
    getPerson(ctx, personId),
    listPersonIncomes(ctx, personId),
    listAgencies(ctx),
  ]);

  // A agência do processo manda; sem ela, vale a de relacionamento que o
  // cliente já tem na Caixa (capturada do próprio portal).
  const agencia =
    agencias.find((item) => item.id === agencyId) ??
    (pessoa.relationshipAgencyNumber
      ? {
          number: pessoa.relationshipAgencyNumber,
          city: pessoa.relationshipAgencyCity,
          uf: pessoa.relationshipAgencyUf,
        }
      : null);

  return {
    personId: pessoa.id,
    personName: pessoa.fullName,
    values: {
      ...toCaixaValues(pessoa as unknown as Record<string, unknown>),
      ...toCaixaAgencyValues(agencia),
    },
    // A tela de renda do portal cadastra uma fonte por vez: a extensão
    // precisa da lista para o operador escolher qual está preenchendo.
    incomes: rendas.map((renda) => ({
      id: renda.id,
      label: renda.sourceName ?? (renda.kind === "formal" ? "Renda formal" : "Renda informal"),
      kind: renda.kind,
      values: toCaixaIncomeValues(renda as unknown as Record<string, unknown>),
    })),
  };
}
