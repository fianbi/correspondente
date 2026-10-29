import { listPeople } from "@corr/db";
import { contextFromRequest, json, preflight, unauthorized } from "../_auth";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * Clientes do escritório para o painel da extensão: os mexidos por último
 * primeiro, que quase sempre são os que o operador está atendendo.
 */
export async function GET(request: Request) {
  const ctx = await contextFromRequest(request);
  if (!ctx) return unauthorized(request);

  const busca = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const { rows } = await listPeople(ctx, { search: busca, order: "recent", limit: 30 });

  return json(
    request,
    rows.map((pessoa) => ({
      id: pessoa.id,
      cpf: pessoa.cpf,
      fullName: pessoa.fullName,
      city: pessoa.city,
      uf: pessoa.uf,
      updatedAt: pessoa.updatedAt,
    })),
  );
}
