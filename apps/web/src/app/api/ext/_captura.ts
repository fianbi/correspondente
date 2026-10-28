import "server-only";

import {
  personIncomeInputSchema,
  personInputSchema,
  type OrgContext,
  type PersonInput,
} from "@corr/core";
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
  // Listas do portal, já traduzidas para os valores do sistema pela extensão.
  "person.sex": "sex",
  "person.nationality": "nationality",
  "person.nationalityCountry": "nationalityCountry",
  "person.birthUf": "birthUf",
  "person.birthCity": "birthCity",
  "person.educationLevel": "educationLevel",
  "person.docType": "docType",
  "person.docIssuerUf": "docIssuerUf",
  "person.docFirstLicenseDate": "docFirstLicenseDate",
  "person.docIssuerCountry": "docIssuerCountry",
  "person.maritalStatus": "maritalStatus",
  "person.streetType": "streetType",
  "person.uf": "uf",
  "person.propertyType": "propertyType",
  "person.housingSituation": "housingSituation",
  "person.residenceProofMonth": "residenceProofMonth",
  "person.residenceProofYear": "residenceProofYear",
  "person.phone": "phone",
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
  | { ok: true; applied: string[]; ignored: string[] }
  | { ok: false; error: string };

/** Colunas do cadastro da pessoa, na forma que o schema espera. */
const COLUNAS_DA_PESSOA = Object.keys(personInputSchema.shape);

/**
 * Valida um campo sozinho, pela regra do próprio campo. Um valor que o portal
 * mostra num formato que o sistema não aceita (data, PIS, e-mail) fica de
 * fora sem levar junto os outros campos da mesma tela. As regras entre campos
 * (casado exige o nome do cônjuge) ficam para o formulário da web: a tela do
 * banco chega aos pedaços, e o estado civil vem antes do cônjuge.
 */
function validarCampo(coluna: string, valor: unknown): { ok: boolean; valor?: unknown } {
  const regra = (personInputSchema.shape as Record<string, { safeParse: (v: unknown) => { success: boolean; data?: unknown } }>)[coluna];
  if (!regra) return { ok: false };
  const parsed = regra.safeParse(valor);
  return parsed.success ? { ok: true, valor: parsed.data } : { ok: false };
}

/**
 * Traz para o cadastro da pessoa o que estava na tela do portal.
 *
 * Vale para a captura manual (processo escolhido no painel) e para a
 * automática (pessoa achada pelo CPF). Só as chaves da lista acima são
 * aceitas, e o CPF nunca é sobrescrito: ele é a identidade do cadastro, e
 * deixar a tela do banco trocá-lo transformaria uma pessoa em outra sem
 * ninguém perceber.
 *
 * Cada campo é validado sozinho e gravado por cima do cadastro como está no
 * banco, sem revalidar o resto: um cadastro antigo incompleto (casado sem o
 * nome do cônjuge, por exemplo) não pode travar a captura das outras telas.
 */
export async function aplicarCaptura(
  ctx: OrgContext,
  personId: string,
  recebidos: Record<string, string | null>,
): Promise<ResultadoCaptura> {
  const pessoa = (await getPerson(ctx, personId)) as unknown as Record<string, unknown>;
  const novos: Record<string, unknown> = {};
  const aplicados: string[] = [];
  const ignorados: string[] = [];

  for (const [chave, coluna] of Object.entries(CAMPOS_ACEITOS)) {
    const valor = recebidos[chave];
    if (valor === undefined || valor === null || valor === "") continue;
    // Só preenche o que está vazio: o cadastro do escritório é a fonte, o
    // portal complementa. Sobrescrever calado desfaria conferência humana.
    if (pessoa[coluna] !== null && pessoa[coluna] !== undefined && pessoa[coluna] !== "") continue;

    const validado = validarCampo(
      coluna,
      EM_CENTAVOS.has(coluna) ? Number(valor) / 100 : valor,
    );
    if (!validado.ok) {
      ignorados.push(chave);
      continue;
    }
    novos[coluna] = validado.valor;
    aplicados.push(chave);
  }

  if (aplicados.length > 0) {
    const atual = Object.fromEntries(COLUNAS_DA_PESSOA.map((coluna) => [coluna, pessoa[coluna] ?? null]));
    await updatePerson(ctx, personId, { ...atual, ...novos } as PersonInput);
  }

  return { ok: true, applied: aplicados, ignored: ignorados };
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

/**
 * Cria quem ainda não existe no escritório.
 *
 * O cadastro nasce da tela de dados cadastrais do portal, que mostra o CPF e
 * o nome completo; sem nome não há cadastro, e quem cria é a tela seguinte
 * que o trouxer. Os outros campos entram como na captura: cada um validado
 * sozinho. Devolve o id, ou `null` quando a tela não basta.
 */
export async function criarPessoaDaTela(
  ctx: OrgContext,
  cpf: string,
  recebidos: Record<string, string | null>,
): Promise<string | null> {
  const minimo = personInputSchema.safeParse({ cpf, fullName: recebidos["person.fullName"] ?? "" });
  if (!minimo.success) return null;

  const campos: Record<string, unknown> = {};
  for (const [chave, coluna] of Object.entries(CAMPOS_ACEITOS)) {
    const valor = recebidos[chave];
    if (valor === undefined || valor === null || valor === "" || coluna === "fullName") continue;
    const validado = validarCampo(coluna, EM_CENTAVOS.has(coluna) ? Number(valor) / 100 : valor);
    if (validado.ok) campos[coluna] = validado.valor;
  }

  try {
    return (await createPerson(ctx, { ...minimo.data, ...campos } as PersonInput)).id;
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
  const cpf = recebidos["person.spouseCpf"]?.replace(/\D+/g, "") ?? "";
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
