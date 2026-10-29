import { NotFoundError } from "@corr/core";
import { getProcess } from "@corr/db";
import { contextFromRequest, json, preflight, unauthorized } from "../../../_auth";
import { dadosParaOPortal } from "../../../_dados";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/** Dados do processo já traduzidos para os códigos do portal. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextFromRequest(request);
  if (!ctx) return unauthorized(request);

  const { id } = await params;

  try {
    const processo = await getProcess(ctx, id);
    const dados = await dadosParaOPortal(ctx, processo.personId, processo.agencyId);
    return json(request, { processId: processo.id, number: processo.number, ...dados });
  } catch (error) {
    if (error instanceof NotFoundError) return json(request, { error: error.message }, 404);
    throw error;
  }
}
