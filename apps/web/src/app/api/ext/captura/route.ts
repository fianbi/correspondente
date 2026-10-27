import { findPersonByCpf } from "@corr/db";
import { adicionarRendas, aplicarCaptura } from "../_captura";
import { contextFromRequest, json, preflight, unauthorized } from "../_auth";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * Captura automática: a extensão leu a tela do portal no envio do formulário
 * (ou na saída da página) e manda o que leu, com o CPF da sessão de cadastro.
 *
 * Ninguém escolheu processo, então a pessoa é achada pelo CPF dentro do
 * escritório. CPF sem cadastro não cria ninguém: pessoa nova nasce no sistema,
 * conferida, e a resposta só diz que não achou.
 */
export async function POST(request: Request) {
  const ctx = await contextFromRequest(request);
  if (!ctx) return unauthorized(request);

  const body = (await request.json().catch(() => null)) as {
    cpf?: unknown;
    values?: unknown;
    incomes?: unknown;
  } | null;

  const cpf = typeof body?.cpf === "string" ? body.cpf.replace(/\D+/g, "") : "";
  if (cpf.length !== 11) return json(request, { error: "Informe o CPF." }, 400);

  const values =
    body?.values && typeof body.values === "object"
      ? (body.values as Record<string, string | null>)
      : {};

  const pessoa = await findPersonByCpf(ctx, cpf);
  if (!pessoa) return json(request, { found: false, applied: [] });

  const resultado = await aplicarCaptura(ctx, pessoa.id, values);
  if (!resultado.ok) return json(request, { error: resultado.error }, 400);

  const rendas = Array.isArray(body?.incomes) ? body.incomes : [];
  const rendasNovas = rendas.length > 0 ? await adicionarRendas(ctx, pessoa.id, rendas) : 0;

  return json(request, {
    found: true,
    applied: resultado.applied,
    incomesAdded: rendasNovas,
    personId: pessoa.id,
  });
}
