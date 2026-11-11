import { NotFoundError } from "@corr/core";
import { getOrg, getPerson, getProcess, listPersonIncomes } from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { paginaDaDamp } from "@/server/damp";
import { participantesDaDamp } from "@/server/damp/participantes";

/**
 * DAMP (MO29300) de um participante: a página offline da Caixa, já
 * preenchida. O operador completa o que falta e imprime por ela.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; personId: string }> },
) {
  const ctx = await requireOrgContext();
  const { id, personId } = await params;

  try {
    const [process, org] = await Promise.all([getProcess(ctx, id), getOrg(ctx)]);
    if (!participantesDaDamp(process).some((p) => p.personId === personId)) {
      return new Response("Essa pessoa não é proponente do processo.", { status: 404 });
    }
    const [pessoa, rendas] = await Promise.all([
      getPerson(ctx, personId),
      listPersonIncomes(ctx, personId),
    ]);

    const html = paginaDaDamp({ pessoa, rendas, processo: process, escritorio: org });
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) return new Response(error.message, { status: 404 });
    throw error;
  }
}
