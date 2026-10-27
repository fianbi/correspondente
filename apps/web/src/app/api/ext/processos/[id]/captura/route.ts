import { NotFoundError } from "@corr/core";
import { getProcess } from "@corr/db";
import { aplicarCaptura } from "../../../_captura";
import { contextFromRequest, json, preflight, unauthorized } from "../../../_auth";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/** Captura manual: o operador escolheu o processo no painel e clicou em trazer. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextFromRequest(request);
  if (!ctx) return unauthorized(request);

  const { id } = await params;
  const body = (await request.json()) as { values?: Record<string, string | null> };

  try {
    const processo = await getProcess(ctx, id);
    const resultado = await aplicarCaptura(ctx, processo.personId, body.values ?? {});
    if (!resultado.ok) return json(request, { error: resultado.error }, 400);
    return json(request, { applied: resultado.applied, personId: processo.personId });
  } catch (error) {
    if (error instanceof NotFoundError) return json(request, { error: error.message }, 404);
    throw error;
  }
}
