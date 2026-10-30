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
  updatePersonIncome,
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
  "person.purposeAccounts": "purposeAccounts",
  "person.purposeLoans": "purposeLoans",
  "person.purposeHousingLoan": "purposeHousingLoan",
  "person.purposeInvestments": "purposeInvestments",
  "person.purposeCreditCard": "purposeCreditCard",
  "person.purposeInsurance": "purposeInsurance",
  "person.purposeForeignExchange": "purposeForeignExchange",
  "person.relationshipAgencyNumber": "relationshipAgencyNumber",
  "person.relationshipAgencyCity": "relationshipAgencyCity",
  "person.relationshipAgencyUf": "relationshipAgencyUf",
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

/** Compara o valor do banco com o da tela (datas chegam como texto ou Date). */
function mesmoValor(atual: unknown, novo: unknown): boolean {
  const normalizar = (valor: unknown) =>
    valor instanceof Date ? valor.toISOString().slice(0, 10) : valor === undefined ? null : valor;
  return normalizar(atual) === normalizar(novo);
}

/**
 * Traz para o cadastro da pessoa o que estava na tela do portal.
 *
 * O portal é a fonte: um campo que a tela mostra diferente do cadastro é
 * atualizado; igual, não é regravado; vazio na tela, não apaga nada.
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
    const validado = validarCampo(
      coluna,
      EM_CENTAVOS.has(coluna) ? Number(valor) / 100 : valor,
    );
    if (!validado.ok) {
      ignorados.push(chave);
      continue;
    }
    // O portal é a fonte: o que a tela mostra atualiza o cadastro. Só não
    // grava o que já está igual, e campo vazio na tela nunca apaga nada.
    if (mesmoValor(pessoa[coluna], validado.valor)) continue;
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
 * Identidade de uma renda: o tipo e de onde ela vem (documento da fonte
 * pagadora, nome da atividade ou ocupação). Sem nada disso, a data de
 * início. É o que reconhece a mesma renda quando o valor muda no portal.
 */
function identidadeDaRenda(renda: {
  kind: string;
  startDate: string | null;
  sourceDocument: string | null;
  sourceName: string | null;
  occupation: string | null;
}): string {
  const origem = (renda.sourceDocument ?? renda.sourceName ?? renda.occupation ?? "").trim();
  return [renda.kind, origem ? origem.toLowerCase() : `inicio:${renda.startDate ?? ""}`].join("|");
}

export interface ResultadoRendas {
  adicionadas: number;
  atualizadas: number;
}

/**
 * Traz as rendas que o portal tem cadastradas.
 *
 * O portal é a fonte: renda nova entra, e a que o sistema já tem (mesma
 * identidade) é atualizada com o que a tela mostra, campo a campo, sem apagar
 * o que a tela não traz. Nada é removido: a lista do portal não tem tudo o
 * que o sistema guarda (renda lançada só na web, por exemplo), e quem decide
 * tirar uma renda do cadastro é o escritório.
 */
export async function adicionarRendas(
  ctx: OrgContext,
  personId: string,
  recebidas: unknown[],
): Promise<ResultadoRendas> {
  const existentes = new Map(
    (await listPersonIncomes(ctx, personId)).map((renda) => [identidadeDaRenda(renda), renda]),
  );
  const resultado: ResultadoRendas = { adicionadas: 0, atualizadas: 0 };

  for (const recebida of recebidas) {
    const parsed = personIncomeInputSchema.safeParse(recebida);
    // Uma renda ilegível não derruba as outras nem o resto da captura.
    if (!parsed.success) continue;

    const identidade = identidadeDaRenda(parsed.data);
    const existente = existentes.get(identidade);

    if (!existente) {
      existentes.set(identidade, await addPersonIncome(ctx, personId, parsed.data));
      resultado.adicionadas += 1;
      continue;
    }

    const mudancas = Object.fromEntries(
      Object.entries(parsed.data).filter(
        ([coluna, valor]) =>
          valor !== null && !mesmoValor((existente as Record<string, unknown>)[coluna], valor),
      ),
    );
    if (Object.keys(mudancas).length === 0) continue;

    existentes.set(identidade, await updatePersonIncome(ctx, existente.id, mudancas));
    resultado.atualizadas += 1;
  }

  return resultado;
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
