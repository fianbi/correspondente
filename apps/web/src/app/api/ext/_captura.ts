import "server-only";

import { personIncomeInputSchema, personInputSchema, type OrgContext } from "@corr/core";
import {
  addPersonIncome,
  createPerson,
  DuplicatePersonError,
  findPersonByCpf,
  getPerson,
  listPersonIncomes,
  updatePerson,
} from "@corr/db";

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
  "person.dependentsCount": "dependentsCount",
  "person.rentCents": "rentCents",
  "person.condoFeeCents": "condoFeeCents",
  "person.alimonyCents": "alimonyCents",
};

/**
 * Colunas de dinheiro. O schema da pessoa lê dinheiro em reais, como o
 * formulário manda; o portal (depois da leitura) e o banco falam em centavos.
 */
const EM_CENTAVOS = new Set(["rentCents", "condoFeeCents", "alimonyCents"]);

export type ResultadoCaptura =
  | { ok: true; applied: string[] }
  | { ok: false; error: string };

/**
 * Traz para o cadastro da pessoa o que estava na tela do portal.
 *
 * Vale para a captura manual (processo escolhido no painel) e para a
 * automática (pessoa achada pelo CPF). Só as chaves da lista acima são
 * aceitas, e o CPF nunca é sobrescrito: ele é a identidade do cadastro, e
 * deixar a tela do banco trocá-lo transformaria uma pessoa em outra sem
 * ninguém perceber.
 */
export async function aplicarCaptura(
  ctx: OrgContext,
  personId: string,
  recebidos: Record<string, string | null>,
): Promise<ResultadoCaptura> {
  const pessoa = await getPerson(ctx, personId);

  const atualizacao: Record<string, unknown> = { ...pessoa };
  // O banco guarda centavos; o schema espera reais, como o formulário manda.
  for (const coluna of EM_CENTAVOS) {
    if (typeof atualizacao[coluna] === "number") atualizacao[coluna] = (atualizacao[coluna] as number) / 100;
  }
  const aplicados: string[] = [];

  for (const [chave, coluna] of Object.entries(CAMPOS_ACEITOS)) {
    const valor = recebidos[chave];
    if (valor === undefined || valor === null || valor === "") continue;
    // Só preenche o que está vazio: o cadastro do escritório é a fonte, o
    // portal complementa. Sobrescrever calado desfaria conferência humana.
    if (atualizacao[coluna]) continue;
    atualizacao[coluna] = EM_CENTAVOS.has(coluna) ? Number(valor) / 100 : valor;
    aplicados.push(chave);
  }

  if (aplicados.length > 0) {
    const parsed = personInputSchema.safeParse({ ...atualizacao, cpf: pessoa.cpf });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }
    await updatePerson(ctx, pessoa.id, parsed.data);
  }

  return { ok: true, applied: aplicados };
}

/**
 * Identidade de uma renda: tipo, início e de onde ela vem. Com isso, ler a
 * mesma lista do portal de novo não duplica nada.
 */
function identidadeDaRenda(renda: {
  kind: string;
  startDate: string | null;
  sourceDocument: string | null;
  sourceName: string | null;
  occupation: string | null;
}): string {
  const origem = renda.sourceDocument ?? renda.sourceName ?? renda.occupation ?? "";
  return [renda.kind, renda.startDate ?? "", origem.trim().toLowerCase()].join("|");
}

/**
 * Traz as rendas que o portal já tem cadastradas.
 *
 * Só acrescenta: uma renda que o sistema já tem (mesma identidade) fica como
 * está, mesmo que o portal mostre outro valor, pela mesma regra dos campos da
 * pessoa. E nada é apagado — renda que sumiu do portal pode ter sido só um
 * ajuste na tela, e quem decide tirar do cadastro é o escritório.
 */
export async function adicionarRendas(
  ctx: OrgContext,
  personId: string,
  recebidas: unknown[],
): Promise<number> {
  const existentes = new Set((await listPersonIncomes(ctx, personId)).map(identidadeDaRenda));
  let adicionadas = 0;

  for (const recebida of recebidas) {
    const parsed = personIncomeInputSchema.safeParse(recebida);
    // Uma renda ilegível não derruba as outras nem o resto da captura.
    if (!parsed.success) continue;

    const identidade = identidadeDaRenda(parsed.data);
    if (existentes.has(identidade)) continue;

    await addPersonIncome(ctx, personId, parsed.data);
    existentes.add(identidade);
    adicionadas += 1;
  }

  return adicionadas;
}

/** Chaves da tela que entram no cadastro (as aceitas e preenchidas). */
export function chavesAceitas(recebidos: Record<string, string | null>): string[] {
  return Object.keys(CAMPOS_ACEITOS).filter((chave) => Boolean(recebidos[chave]));
}

/** Só as colunas aceitas, já no formato que o schema da pessoa lê. */
function camposDaTela(recebidos: Record<string, string | null>): Record<string, unknown> {
  const campos: Record<string, unknown> = {};
  for (const [chave, coluna] of Object.entries(CAMPOS_ACEITOS)) {
    const valor = recebidos[chave];
    if (valor === undefined || valor === null || valor === "") continue;
    campos[coluna] = EM_CENTAVOS.has(coluna) ? Number(valor) / 100 : valor;
  }
  return campos;
}

/**
 * Cria quem ainda não existe no escritório.
 *
 * O cadastro nasce da tela de dados cadastrais do portal, que mostra o CPF e
 * o nome completo; sem nome não há cadastro, e quem cria é a tela seguinte
 * que o trouxer. Devolve o id, ou `null` quando a tela não basta.
 */
export async function criarPessoaDaTela(
  ctx: OrgContext,
  cpf: string,
  recebidos: Record<string, string | null>,
): Promise<string | null> {
  const parsed = personInputSchema.safeParse({ ...camposDaTela(recebidos), cpf });
  if (!parsed.success) return null;

  try {
    return (await createPerson(ctx, parsed.data)).id;
  } catch (error) {
    // Duas leituras da mesma tela chegando juntas: a outra já criou.
    if (error instanceof DuplicatePersonError) return error.personId;
    throw error;
  }
}

/**
 * Cônjuge informado na tela vira cadastro também, se ainda não existir. Só
 * CPF e nome: o resto do cadastro dele vem quando a tela for a dele.
 */
export async function garantirConjuge(
  ctx: OrgContext,
  recebidos: Record<string, string | null>,
): Promise<boolean> {
  const cpf = recebidos["person.spouseCpf"]?.replace(/D+/g, "") ?? "";
  const nome = recebidos["person.spouseName"]?.trim() ?? "";
  if (cpf.length !== 11 || nome === "") return false;
  if (await findPersonByCpf(ctx, cpf)) return false;

  const parsed = personInputSchema.safeParse({ cpf, fullName: nome });
  if (!parsed.success) return false;

  try {
    await createPerson(ctx, parsed.data);
    return true;
  } catch (error) {
    if (error instanceof DuplicatePersonError) return false;
    throw error;
  }
}
