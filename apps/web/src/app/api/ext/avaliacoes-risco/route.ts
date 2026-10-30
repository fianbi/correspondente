import { findPersonByCpf, saveRiskAssessments, type RiskAssessmentInput } from "@corr/db";
import { contextFromRequest, json, preflight, unauthorized } from "../_auth";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * A extensão leu a tela "Consulta de Formulários Enviados" do SICAQ e manda as
 * linhas com avaliação de risco do CPF consultado.
 *
 * Não cria pessoa: a tela só mostra o CPF, e um cadastro sem nome não serve a
 * ninguém. CPF sem cadastro volta `found: false`, e a avaliação entra quando o
 * operador passar pelo cadastro e consultar de novo.
 */
export async function POST(request: Request) {
  const ctx = await contextFromRequest(request);
  if (!ctx) return unauthorized(request);

  const body = (await request.json().catch(() => null)) as {
    cpf?: unknown;
    rows?: unknown;
  } | null;

  const cpf = typeof body?.cpf === "string" ? body.cpf.replace(/\D+/g, "") : "";
  if (cpf.length !== 11) return json(request, { error: "Informe o CPF." }, 400);

  const rows = (Array.isArray(body?.rows) ? body.rows : [])
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map(paraEntrada)
    .filter((row): row is RiskAssessmentInput => row !== null)
    .slice(0, 100);

  const pessoa = await findPersonByCpf(ctx, cpf);
  if (!pessoa) return json(request, { found: false, added: 0, updated: 0, linkedProcesses: [] });

  const resultado = await saveRiskAssessments(ctx, pessoa.id, rows);
  return json(request, { found: true, personId: pessoa.id, ...resultado });
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor : null;
}

function paraEntrada(row: Record<string, unknown>): RiskAssessmentInput | null {
  const proposalNumber = texto(row.proposalNumber);
  if (!proposalNumber) return null;
  return {
    proposalNumber,
    sentOn: texto(row.sentOn),
    product: texto(row.product),
    conformity: texto(row.conformity),
    result: texto(row.riskResult),
    details: texto(row.riskDetails),
    validUntil: texto(row.riskValidUntil),
    requestType: texto(row.requestType),
  };
}
