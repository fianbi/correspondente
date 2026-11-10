import "server-only";

import { montarOpcao, PERGUNTAR_MARCAR } from "../../../lib/formularios";
import { CAIXA_MO43047011_PDF_BASE64 } from "./caixa-mo43047011";

/**
 * Formulários do banco que o sistema já traz prontos: PDF com campos e
 * mapeamento feitos. O escritório só clica em "Adicionar" — em vez de achar a
 * versão editável do formulário e ligar campo por campo.
 */
export interface ModeloPronto {
  chave: string;
  nome: string;
  descricao: string;
  pdf: () => Uint8Array;
  fieldMap: Record<string, string>;
}

export const MODELOS_PRONTOS: ModeloPronto[] = [
  {
    chave: "caixa-mo43047011",
    nome: "Caixa — Ateste de verificação documental (MO43047011)",
    descricao:
      "Apresentação de propostas, informações complementares e ateste do CCA. Programa, cheque especial, cartão, consignado e comprovante de endereço são perguntados ao gerar.",
    pdf: () => Uint8Array.from(Buffer.from(CAIXA_MO43047011_PDF_BASE64, "base64")),
    fieldMap: {
      "Razão Social - CCA": "org.name",
      "Código - CCA": "org.internalCode",
      Proponente: "person.fullName",
      "CPF do proponente": "person.cpf",
      Coobrigado: "coobrigado.fullName",
      "CPF do coobrigado": "coobrigado.cpf",
      "Dossiê Principal": "marcar.sempre",
      "Conta Corrente": "marcar.conta_corrente",
      "Conta Corrente - Agência": "process.checking_agency",
      "Conta Corrente - Operação": "process.checking_operation",
      "Conta Corrente - Conta": "process.checking_account_number",
      "Conta Corrente - DV": "process.checking_dv",
      "Cheque Especial": PERGUNTAR_MARCAR,
      "Cartão de Crédito": PERGUNTAR_MARCAR,
      "Crédito Consignado": PERGUNTAR_MARCAR,
      // Os rótulos impressos (PCVA, CCFGTS, CCSBPE) foram trocados no PDF pelos
      // programas que o escritório usa. Escolha obrigatória.
      MCMV: montarOpcao("Programa habitacional", "MCMV"),
      SBPE: montarOpcao("Programa habitacional", "SBPE"),
      "PRO-COTISTA": montarOpcao("Programa habitacional", "PRO-COTISTA"),
      EGI: montarOpcao("Programa habitacional", "EGI"),
      "#obrigatorio:Programa habitacional": "1",
      "Nº do Contrato": "process.contract_number",
      Construtora: "process.builder",
      Empreendimento: "process.development",
      // Opcional: sem resposta, os dois quadrinhos ficam em branco.
      "Comprovante de Endereço - Titular": montarOpcao("Comprovante de endereço", "Titular"),
      "Comprovante de Endereço - Em Nome de Terceiros": montarOpcao(
        "Comprovante de endereço",
        "Em nome de terceiros",
      ),
      "Renda Formal": "marcar.renda_formal",
      "Outras Rendas": "marcar.renda_informal",
      "Declaração - sócios/familiares não participam": "marcar.sempre",
      Local: "org.city",
      Dia: "hoje.dia",
      Mês: "hoje.mes",
      Ano: "hoje.ano",
    },
  },
];

/** Modelo pronto de onde um modelo do escritório veio (pela marca ou pelo nome). */
export function origemPronta(template: { name: string; fieldMap: Record<string, string> }) {
  return MODELOS_PRONTOS.find(
    (modelo) => template.fieldMap["#pronto"] === modelo.chave || template.name === modelo.nome,
  );
}

export function getModeloPronto(chave: string): ModeloPronto | undefined {
  return MODELOS_PRONTOS.find((modelo) => modelo.chave === chave);
}
