import "server-only";

import {
  montarOpcao,
  PERGUNTAR_MARCAR,
  perguntasDoModelo,
  type Pergunta,
} from "../../../lib/formularios";
import { CAIXA_MO30825_PDF_BASE64 } from "./caixa-mo30825";
import { CAIXA_MO30844_PDF_BASE64 } from "./caixa-mo30844";
import { CAIXA_MO43047011_PDF_BASE64 } from "./caixa-mo43047011";

/**
 * Formulários do banco que o sistema já traz prontos.
 *
 * O fundo é o formulário da Caixa como ela distribui (convertido em PDF); os
 * valores são escritos por cima, na mesma letra e tamanho do formulário, logo
 * depois de cada rótulo. Não são campos de PDF de tamanho fixo: o texto cresce
 * com o conteúdo e, onde o espaço acaba, quebra para a linha de baixo.
 *
 * Cada item diz onde escrever e de onde vem o valor: uma chave do cadastro
 * (`person.cpf`, `process.builder`…), uma chave calculada (`hoje.dia`,
 * `marcar.renda_formal`…) ou uma pergunta feita na hora de gerar
 * (`perguntar.marcar`, `perguntar.opcao:Grupo=Opção`, ver lib/formularios).
 * Coordenadas em pontos, medidas do topo da página; `base` é a linha de base
 * do texto. `pagina` conta a partir de 0 (padrão: a primeira).
 */
export type ItemDoModelo = { pagina?: number } & (
  | {
      tipo: "texto";
      rotulo: string;
      valor: string;
      x: number;
      base: number;
      /** Largura disponível: passou disso, quebra linha para baixo. */
      largura?: number;
      centralizar?: boolean;
      /** Tamanho da letra; padrão, o do formulário (11). */
      tamanho?: number;
    }
  | {
      /** Quadrinho: recebe "X" quando o valor vem preenchido. */
      tipo: "marca";
      rotulo: string;
      valor: string;
      x: number;
      topo: number;
      largura: number;
      altura: number;
    }
  | {
      /** Linha com rótulos e valores intercalados, reescrita inteira. */
      tipo: "linha";
      x: number;
      base: number;
      partes: (string | { valor: string })[];
    }
);

export interface ModeloPronto {
  chave: string;
  nome: string;
  descricao: string;
  fundo: () => Uint8Array;
  itens: ItemDoModelo[];
  /** Ordem e obrigatoriedade das perguntas de opção (`#opcoes:`, `#obrigatorio:`). */
  extras: Record<string, string>;
}

const PROGRAMA = "Programa habitacional";
const COMPROVANTE = "Comprovante de endereço";

/** Quadrinhos impressos no formulário (topo-esquerdo, 16×14). */
const quadrinho = (x: number, topo: number, altura = 14) => ({ x, topo, largura: 16, altura });

/**
 * Bloco de assinaturas dos formulários da Caixa: "Local e Data" e quatro
 * linhas de assinatura, duas por fileira. Embaixo de cada linha sai o nome e
 * o CPF do participante; a legenda "(1º participante/CPF)" fica logo abaixo
 * (já no fundo).
 */
function assinaturas(
  pagina: number,
  quem: "participante" | "proponente",
  localData: number,
  fileiras: [number, number],
): ItemDoModelo[] {
  const itens: ItemDoModelo[] = [
    { pagina, tipo: "texto", rotulo: "Local e data", valor: "local.data", x: 57, base: localData, largura: 265 },
  ];
  fileiras.forEach((base, fileira) => {
    [57, 304].forEach((x, coluna) => {
      const ordem = fileira * 2 + coluna + 1;
      itens.push({
        pagina,
        tipo: "texto",
        rotulo: `Assinatura do ${ordem}º ${quem}`,
        valor: `${quem}.${ordem}.assinatura`,
        x,
        base,
        largura: 235,
        tamanho: 9,
      });
    });
  });
  return itens;
}

export const MODELOS_PRONTOS: ModeloPronto[] = [
  {
    chave: "caixa-mo43047011",
    nome: "Caixa — Ateste de verificação documental (MO43047011)",
    descricao:
      "Apresentação de propostas, informações complementares e ateste do CCA. Programa, cheque especial, cartão, consignado e comprovante de endereço são perguntados ao gerar.",
    fundo: () => Uint8Array.from(Buffer.from(CAIXA_MO43047011_PDF_BASE64, "base64")),
    itens: [
      { tipo: "texto", rotulo: "Razão Social", valor: "org.name", x: 62, base: 171, largura: 362 },
      { tipo: "texto", rotulo: "Código CCA", valor: "org.internalCode", x: 431, base: 171 },
      {
        tipo: "texto",
        rotulo: "Proponente",
        valor: "person.fullName",
        x: 62,
        base: 210.5,
        largura: 362,
      },
      { tipo: "texto", rotulo: "CPF do proponente", valor: "person.cpf", x: 431, base: 210.5 },
      {
        tipo: "texto",
        rotulo: "Coobrigado",
        valor: "coobrigado.fullName",
        x: 62,
        base: 249.5,
        largura: 362,
      },
      { tipo: "texto", rotulo: "CPF do coobrigado", valor: "coobrigado.cpf", x: 431, base: 249.5 },
      { tipo: "marca", rotulo: "Dossiê Principal", valor: "marcar.sempre", ...quadrinho(58, 264) },
      {
        tipo: "marca",
        rotulo: "Conta Corrente",
        valor: "marcar.conta_corrente",
        ...quadrinho(55, 309, 12),
      },
      {
        tipo: "linha",
        x: 181,
        base: 319,
        partes: [
          "Agência ",
          { valor: "process.checking_agency" },
          "   Operação ",
          { valor: "process.checking_operation" },
          "   Conta ",
          { valor: "process.checking_account_number" },
          "   DV ",
          { valor: "process.checking_dv" },
        ],
      },
      {
        tipo: "marca",
        rotulo: "Cheque Especial",
        valor: PERGUNTAR_MARCAR,
        ...quadrinho(55, 337, 12),
      },
      {
        tipo: "marca",
        rotulo: "Cartão de Crédito",
        valor: PERGUNTAR_MARCAR,
        x: 180,
        topo: 337,
        largura: 22,
        altura: 12,
      },
      {
        tipo: "marca",
        rotulo: "Crédito Consignado",
        valor: PERGUNTAR_MARCAR,
        ...quadrinho(324, 337, 12),
      },
      {
        tipo: "marca",
        rotulo: "MCMV",
        valor: montarOpcao(PROGRAMA, "MCMV"),
        ...quadrinho(58, 381),
      },
      {
        tipo: "marca",
        rotulo: "SBPE",
        valor: montarOpcao(PROGRAMA, "SBPE"),
        ...quadrinho(132, 381),
      },
      {
        tipo: "marca",
        rotulo: "PRO-COTISTA",
        valor: montarOpcao(PROGRAMA, "PRO-COTISTA"),
        ...quadrinho(224, 381),
      },
      { tipo: "marca", rotulo: "EGI", valor: montarOpcao(PROGRAMA, "EGI"), ...quadrinho(341, 381) },
      {
        tipo: "texto",
        rotulo: "Nº do Contrato",
        valor: "process.contract_number",
        x: 136,
        base: 417.5,
        largura: 398,
      },
      {
        tipo: "texto",
        rotulo: "Construtora",
        valor: "process.builder",
        x: 121,
        base: 442.5,
        largura: 141,
      },
      {
        tipo: "texto",
        rotulo: "Empreendimento",
        valor: "process.development",
        x: 353,
        base: 442.5,
        largura: 183,
      },
      {
        tipo: "marca",
        rotulo: "Renda Formal",
        valor: "marcar.renda_formal",
        ...quadrinho(56, 487, 15),
      },
      {
        tipo: "marca",
        rotulo: "Outras Rendas",
        valor: "marcar.renda_informal",
        ...quadrinho(131, 487, 15),
      },
      {
        tipo: "marca",
        rotulo: "Titular",
        valor: montarOpcao(COMPROVANTE, "Titular"),
        ...quadrinho(293, 487, 15),
      },
      {
        tipo: "marca",
        rotulo: "Em nome de terceiros",
        valor: montarOpcao(COMPROVANTE, "Em nome de terceiros"),
        ...quadrinho(365, 487, 15),
      },
      {
        tipo: "marca",
        rotulo: "Declaração do CCA",
        valor: "marcar.sempre",
        x: 61,
        topo: 513,
        largura: 23,
        altura: 12,
      },
      { tipo: "texto", rotulo: "Local", valor: "org.city", x: 59, base: 648.5, largura: 258 },
      {
        tipo: "texto",
        rotulo: "Dia",
        valor: "hoje.dia",
        x: 327,
        base: 648.5,
        largura: 40,
        centralizar: true,
      },
      {
        tipo: "texto",
        rotulo: "Mês",
        valor: "hoje.mes",
        x: 383,
        base: 648.5,
        largura: 97,
        centralizar: true,
      },
      {
        tipo: "texto",
        rotulo: "Ano",
        valor: "hoje.ano",
        x: 497,
        base: 648.5,
        largura: 41,
        centralizar: true,
      },
    ],
    extras: {
      [`#opcoes:${PROGRAMA}`]: "MCMV|SBPE|PRO-COTISTA|EGI",
      [`#obrigatorio:${PROGRAMA}`]: "1",
    },
  },
  {
    chave: "caixa-mo30844",
    nome: "Caixa — Autorização da forma de pagamento (MO30844)",
    descricao:
      "Débito da parcela e da tarifa de avaliação na conta corrente da proposta, autorização de consulta ao SCR e assinatura dos participantes.",
    fundo: () => Uint8Array.from(Buffer.from(CAIXA_MO30844_PDF_BASE64, "base64")),
    itens: [
      { tipo: "texto", rotulo: "Cliente", valor: "person.fullName", x: 110, base: 137, largura: 218 },
      { tipo: "texto", rotulo: "CPF", valor: "person.cpf", x: 362, base: 137, largura: 185 },
      {
        tipo: "texto",
        rotulo: "Agência Caixa",
        valor: "process.checking_agency",
        x: 150,
        base: 158.5,
        largura: 178,
      },
      { tipo: "texto", rotulo: "Conta Caixa", valor: "conta.caixa", x: 416, base: 158.5, largura: 131 },
      {
        tipo: "marca",
        rotulo: "Débito da parcela",
        valor: "marcar.sempre",
        x: 60.4,
        topo: 164.5,
        largura: 28.1,
        altura: 12.1,
      },
      {
        tipo: "marca",
        rotulo: "Débito da tarifa de avaliação",
        valor: "marcar.sempre",
        x: 60.4,
        topo: 418.6,
        largura: 28.1,
        altura: 12.1,
      },
      ...assinaturas(1, "participante", 260.5, [326.5, 390]),
    ],
    extras: {},
  },
  {
    chave: "caixa-mo30825",
    nome: "Caixa — Proposta de seguro habitacional (MO30825)",
    descricao:
      "Proponentes do seguro habitacional, \"Desconheço possuir\" marcado para cada um e assinaturas.",
    fundo: () => Uint8Array.from(Buffer.from(CAIXA_MO30825_PDF_BASE64, "base64")),
    itens: [
      ...[168.3, 187.2, 206.1, 225].flatMap((base, indice): ItemDoModelo[] => [
        {
          tipo: "texto",
          rotulo: `Nome do ${indice + 1}º proponente`,
          valor: `proponente.${indice + 1}.nome`,
          x: 90,
          base,
          largura: 283,
        },
        {
          tipo: "texto",
          rotulo: `CPF do ${indice + 1}º proponente`,
          valor: `proponente.${indice + 1}.cpf`,
          x: 385,
          base,
        },
      ]),
      ...[
        [230.5, 315],
        [315, 400],
        [400, 492],
        [492, 570],
      ].map(
        ([inicio, fim], indice): ItemDoModelo => ({
          pagina: 1,
          tipo: "marca",
          rotulo: `Desconheço possuir — ${indice + 1}º proponente`,
          valor: `marcar.proponente.${indice + 1}`,
          x: inicio!,
          topo: 559,
          largura: fim! - inicio!,
          altura: 34,
        }),
      ),
      ...assinaturas(2, "proponente", 114.5, [195, 258.5]),
    ],
    extras: {},
  },
];

/** Perguntas feitas na hora de gerar o modelo pronto. */
export function perguntasDoModeloPronto(modelo: ModeloPronto): Pergunta[] {
  const mapa: Record<string, string> = {};
  for (const item of modelo.itens) if (item.tipo !== "linha") mapa[item.rotulo] = item.valor;
  return perguntasDoModelo({ ...mapa, ...modelo.extras });
}

/** Modelo pronto de onde um modelo do escritório veio (pela marca ou pelo nome). */
export function origemPronta(template: { name: string; fieldMap: Record<string, string> }) {
  return MODELOS_PRONTOS.find(
    (modelo) => template.fieldMap["#pronto"] === modelo.chave || template.name === modelo.nome,
  );
}

export function getModeloPronto(chave: string): ModeloPronto | undefined {
  return MODELOS_PRONTOS.find((modelo) => modelo.chave === chave);
}
