// Só os mapas do portal: o pacote inteiro traz o zod, que não tem lugar no
// content script que roda dentro da página do banco.
import * as portais from "@corr/core/portais";
import type { CaptureOutcome } from "./types";

/**
 * Leitura do portal de volta para o sistema: o inverso de `toCaixaValues`.
 *
 * As listas da tela guardam códigos do SICAQ ("F", "9", "35"). O cadastro do
 * sistema guarda os seus próprios valores ("feminino", "casado_comunhao_parcial",
 * "SP"), e gravar o código cru deixava esses campos vazios na web. Cada
 * lista tem a sua tradução; um código que o sistema não conhece fica de fora,
 * em vez de entrar como valor inválido.
 */

const POR_CODIGO: Record<string, Map<string, string>> = {
  "person.sex": portais.reverseCaixaMap(portais.CAIXA_SEX),
  "person.nationality": portais.reverseCaixaMap(portais.CAIXA_NATIONALITY),
  "person.birthUf": portais.reverseCaixaMap(portais.CAIXA_UF_NATURALIDADE),
  "person.educationLevel": portais.reverseCaixaMap(portais.CAIXA_EDUCATION_LEVEL),
  "person.maritalStatus": portais.reverseCaixaMap(portais.CAIXA_MARITAL_STATUS),
  "person.propertyType": portais.reverseCaixaMap(portais.CAIXA_PROPERTY_TYPE),
  "person.housingSituation": portais.reverseCaixaMap(portais.CAIXA_HOUSING_SITUATION),
  "person.docType": new Map(
    Object.entries(portais.CAIXA_ID_DOCUMENT).map(([tipo, perfil]) => [String(perfil.tipo), tipo]),
  ),
};

/**
 * Listas em que o sistema guarda o nome, não o código: o município e o órgão
 * emissor são texto no cadastro, e o preenchimento casa a opção pelo rótulo.
 */
const PELO_ROTULO = new Set([
  "person.birthCity",
  "person.docIssuer",
  "person.nationalityCountry",
  "person.streetType",
]);

export function fromCaixaOutcome(outcome: CaptureOutcome): CaptureOutcome | null {
  if (outcome.value === null) return outcome;

  const mapa = POR_CODIGO[outcome.dataKey];
  if (mapa) {
    const valor = mapa.get(outcome.value.trim());
    return valor === undefined ? null : { dataKey: outcome.dataKey, value: valor };
  }

  if (PELO_ROTULO.has(outcome.dataKey) && outcome.label) {
    return { dataKey: outcome.dataKey, value: outcome.label };
  }

  return outcome;
}

/** Traduz uma leitura inteira, deixando de fora os códigos desconhecidos. */
export function fromCaixaOutcomes(outcomes: CaptureOutcome[]): CaptureOutcome[] {
  return outcomes
    .map(fromCaixaOutcome)
    .filter((outcome): outcome is CaptureOutcome => outcome !== null);
}
