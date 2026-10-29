import { findPersonByCpf, getProcess, listProcessesForPerson } from "@corr/db";
import { contextFromRequest, json, preflight, unauthorized } from "../../../_auth";
import { dadosParaOPortal } from "../../../_dados";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * O que o botão "Preencher esta tela" escreve no portal para o cliente do CPF.
 *
 * O painel trabalha com o cliente, não com o processo: quem preenche o
 * cadastro do banco ainda nem sempre tem processo aberto. Havendo processo, a
 * agência vem do mais recente.
 */
export async function GET(request: Request, { params }: { params: Promise<{ cpf: string }> }) {
  const ctx = await contextFromRequest(request);
  if (!ctx) return unauthorized(request);

  const cpf = (await params).cpf.replace(/\D+/g, "");
  if (cpf.length !== 11) return json(request, { error: "CPF inválido." }, 400);

  const pessoa = await findPersonByCpf(ctx, cpf);
  if (!pessoa) return json(request, { error: "Cliente sem cadastro no sistema." }, 404);

  const [maisRecente] = await listProcessesForPerson(ctx, pessoa.id);
  const agencyId = maisRecente ? (await getProcess(ctx, maisRecente.id)).agencyId : null;

  return json(request, await dadosParaOPortal(ctx, pessoa.id, agencyId));
}
