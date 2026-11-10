import "server-only";

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
      "Apresentação de propostas, informações complementares e ateste do CCA. Programa, construtora e declaração ficam para marcar no PDF.",
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
      "Conta Poupança": "marcar.conta_poupanca",
      "Cheque Especial": "marcar.cheque_especial",
      "Cartão de Crédito": "marcar.cartao_credito",
      "Nº do Contrato": "process.contract_number",
      "Renda Formal": "marcar.renda_formal",
      "Outras Rendas": "marcar.renda_informal",
      Local: "org.city",
      Dia: "hoje.dia",
      Mês: "hoje.mes",
      Ano: "hoje.ano",
    },
  },
];

export function getModeloPronto(chave: string): ModeloPronto | undefined {
  return MODELOS_PRONTOS.find((modelo) => modelo.chave === chave);
}
