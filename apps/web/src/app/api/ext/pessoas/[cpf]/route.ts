import { findPersonByCpf, getPerson, listPersonIncomes, listProcessesForPerson } from "@corr/db";
import { contextFromRequest, json, preflight, unauthorized } from "../../_auth";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * Cadastro da pessoa do CPF que está na tela do portal, para o painel mostrar
 * ao lado do cadastro do banco. `null` quando o escritório ainda não a tem.
 */
export async function GET(request: Request, { params }: { params: Promise<{ cpf: string }> }) {
  const ctx = await contextFromRequest(request);
  if (!ctx) return unauthorized(request);

  const cpf = (await params).cpf.replace(/\D+/g, "");
  if (cpf.length !== 11) return json(request, { error: "CPF inválido." }, 400);

  const encontrada = await findPersonByCpf(ctx, cpf);
  if (!encontrada) return json(request, null);

  const [pessoa, rendas, processos] = await Promise.all([
    getPerson(ctx, encontrada.id),
    listPersonIncomes(ctx, encontrada.id),
    listProcessesForPerson(ctx, encontrada.id),
  ]);

  return json(request, {
    id: pessoa.id,
    cpf: pessoa.cpf,
    fullName: pessoa.fullName,
    birthDate: pessoa.birthDate,
    motherName: pessoa.motherName,
    email: pessoa.email,
    phone: pessoa.phone,
    city: pessoa.city,
    uf: pessoa.uf,
    maritalStatus: pessoa.maritalStatus,
    spouseName: pessoa.spouseName,
    dependentsCount: pessoa.dependentsCount,
    rentCents: pessoa.rentCents,
    condoFeeCents: pessoa.condoFeeCents,
    alimonyCents: pessoa.alimonyCents,
    incomes: rendas.map((renda) => ({
      kind: renda.kind,
      sourceName: renda.sourceName ?? renda.occupation,
      grossCents: renda.grossCents,
      netCents: renda.netCents,
    })),
    processes: processos.map((processo) => ({
      id: processo.id,
      number: processo.number,
      stage: processo.stage,
      status: processo.status,
    })),
  });
}
