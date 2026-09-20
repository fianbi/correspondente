import { NotFoundError } from "@corr/core";
import { toCaixaValues } from "@corr/portal";
import { getPerson, getProcess } from "@corr/db";
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
    const pessoa = await getPerson(ctx, processo.personId);

    return json(request, {
      processId: processo.id,
      number: processo.number,
      personName: pessoa.fullName,
      values: toCaixaValues(pessoa as unknown as Record<string, unknown>),
    });
  } catch (error) {
    if (error instanceof NotFoundError) return json(request, { error: error.message }, 404);
    throw error;
  }
}
