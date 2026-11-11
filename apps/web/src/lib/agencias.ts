/**
 * Como a agência aparece para o operador: número, nome e cidade.
 *
 * Agência cadastrada só pelo número (digitada no processo) ganha o nome
 * provisório "Agência 1234"; repetir o número no rótulo não diz nada, então
 * nesse caso aparece só o número.
 */
export function rotuloAgencia(agencia: { number: string; name: string; city?: string | null }) {
  const nome = agencia.name.trim();
  const partes = [agencia.number];
  if (nome && nome !== `Agência ${agencia.number}`) partes.push(nome);
  const rotulo = partes.join(" — ");
  return agencia.city ? `${rotulo} (${agencia.city})` : rotulo;
}

/** Número de agência como o operador digita: dígitos, com DV opcional. */
export const NUMERO_AGENCIA = /^\d{1,5}(-[\dXx])?$/;

export interface AgenciaOpcao {
  id: string;
  number: string;
  name: string;
  city: string | null;
}

/** Nomes dos campos extras de uma agência nova, lidos pelo servidor ao salvar. */
export const CAMPO_NOME_AGENCIA_NOVA = "agencia_nova_nome";
export const CAMPO_CIDADE_AGENCIA_NOVA = "agencia_nova_cidade";
