import { NotFoundError } from "@corr/core";
import { toCaixaAgencyValues, toCaixaIncomeValues, toCaixaValues } from "@corr/portal";
import { getPerson, getProcess, listAgencies, listPersonIncomes } from "@corr/db";
import { contextFromRequest, json, preflight, unauthorized } from "../../../_auth";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * Dados do processo já traduzidos para os códigos do portal.
 *
 * A tradução acontece aqui, no servidor, e não na extensão: assim o mapa de
 * códigos de cada banco fica num lugar só, versionado e testado.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextFromRequest(request);
  if (!ctx) return unauthorized(request);

  const { id } = await params;

  try {
    const processo = await getProcess(ctx, id);
    const [pessoa, rendas, agencias] = await Promise.all([
      getPerson(ctx, processo.personId),
      listPersonIncomes(ctx, processo.personId),
      listAgencies(ctx),
    ]);

    // A agência do processo manda; sem ela, vale a de relacionamento que o
    // cliente já tem na Caixa (capturada do próprio portal).
    const agencia =
      agencias.find((item) => item.id === processo.agencyId) ??
      (pessoa.relationshipAgencyNumber
        ? {
            number: pessoa.relationshipAgencyNumber,
            city: pessoa.relationshipAgencyCity,
            uf: pessoa.relationshipAgencyUf,
          }
        : null);

    return json(request, {
      processId: processo.id,
      number: processo.number,
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
    });
  } catch (error) {
    if (error instanceof NotFoundError) return json(request, { error: error.message }, 404);
    throw error;
  }
}
