import { NotFoundError, personInputSchema } from "@corr/core";
import { getPerson, getProcess, updatePerson } from "@corr/db";
import { contextFromRequest, json, preflight, unauthorized } from "../../../_auth";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/** Chaves que a extensão pode escrever de volta, vindas da tela do portal. */
const CAMPOS_ACEITOS: Record<string, string> = {
  "person.fullName": "fullName",
  "person.shortName": "shortName",
  "person.birthDate": "birthDate",
  "person.motherName": "motherName",
  "person.fatherName": "fatherName",
  "person.pis": "pis",
  "person.docNumber": "docNumber",
  "person.docIssuer": "docIssuer",
  "person.docIssuedAt": "docIssuedAt",
  "person.docValidUntil": "docValidUntil",
  "person.spouseName": "spouseName",
  "person.spouseCpf": "spouseCpf",
  "person.zipCode": "zipCode",
  "person.street": "street",
  "person.streetNumber": "streetNumber",
  "person.complement": "complement",
  "person.district": "district",
  "person.city": "city",
  "person.email": "email",
};

/**
 * Traz para o sistema o que está na tela do portal.
 *
 * Só as chaves da lista acima são aceitas, e o CPF nunca é sobrescrito: ele é
 * a identidade do cadastro, e deixar a tela do banco trocá-lo transformaria
 * uma pessoa em outra sem ninguém perceber.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextFromRequest(request);
  if (!ctx) return unauthorized(request);

  const { id } = await params;
  const body = (await request.json()) as { values?: Record<string, string | null> };
  const recebidos = body.values ?? {};

  try {
    const processo = await getProcess(ctx, id);
    const pessoa = await getPerson(ctx, processo.personId);

    const atualizacao: Record<string, unknown> = { ...pessoa };
    const aplicados: string[] = [];

    for (const [chave, coluna] of Object.entries(CAMPOS_ACEITOS)) {
      const valor = recebidos[chave];
      if (valor === undefined || valor === null || valor === "") continue;
      // Só preenche o que está vazio: o cadastro do escritório é a fonte, o
      // portal complementa. Sobrescrever calado desfaria conferência humana.
      if (atualizacao[coluna]) continue;
      atualizacao[coluna] = valor;
      aplicados.push(chave);
    }

    if (aplicados.length > 0) {
      const parsed = personInputSchema.safeParse({
        ...atualizacao,
        cpf: pessoa.cpf,
      });
      if (!parsed.success) {
        return json(request, { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, 400);
      }
      await updatePerson(ctx, pessoa.id, parsed.data);
    }

    return json(request, { applied: aplicados, personId: pessoa.id });
  } catch (error) {
    if (error instanceof NotFoundError) return json(request, { error: error.message }, 404);
    throw error;
  }
}
