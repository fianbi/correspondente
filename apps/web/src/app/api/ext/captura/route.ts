import { findPersonByCpf } from "@corr/db";
import {
  adicionarRendas,
  aplicarCaptura,
  chavesAceitas,
  criarPessoaDaTela,
  garantirConjuge,
} from "../_captura";
import { contextFromRequest, json, preflight, unauthorized } from "../_auth";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * Captura automática: a extensão leu a tela do portal no envio do formulário
 * (ou na saída da página) e manda o que leu, com o CPF da sessão de cadastro.
 *
 * Ninguém escolheu processo, então a pessoa é achada pelo CPF dentro do
 * escritório. CPF sem cadastro vira cadastro novo quando a tela traz o nome
 * completo (a de dados cadastrais); nas outras, a resposta só diz que não
 * achou. Cônjuge informado na tela também vira cadastro, se não existir.
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

  const existente = await findPersonByCpf(ctx, cpf);
  const criadaId = existente ? null : await criarPessoaDaTela(ctx, cpf, values);
  const pessoa = existente ?? (criadaId ? { id: criadaId } : null);
  if (!pessoa) return json(request, { found: false, applied: [] });

  const spouseCreated = await garantirConjuge(ctx, values);
  const resultado = await aplicarCaptura(ctx, pessoa.id, values);
  if (!resultado.ok) return json(request, { error: resultado.error }, 400);

  const rendas = Array.isArray(body?.incomes) ? body.incomes : [];
  const rendasNovas = rendas.length > 0 ? await adicionarRendas(ctx, pessoa.id, rendas) : 0;

  return json(request, {
    found: true,
    created: criadaId !== null,
    spouseCreated,
    // Pessoa recém-criada: o que a tela trouxe entrou na criação, fora o
    // que o sistema não aceitou.
    applied:
      criadaId !== null
        ? chavesAceitas(values).filter((chave) => !resultado.ignored.includes(chave))
        : resultado.applied,
    // Campos que a tela mostrou num formato que o cadastro não aceita.
    ignored: resultado.ignored,
    incomesAdded: rendasNovas,
    personId: pessoa.id,
  });
}
