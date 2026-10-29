import type {
  EducationLevel,
  HousingSituation,
  IdDocumentType,
  IncomeKind,
  IncomeProofType,
  MaritalStatus,
  Nationality,
  PropertyType,
  Sex,
  UF,
} from "../domain/person";

/**
 * Tradução entre o domínio do sistema e os códigos do Caixa Aqui (SICAQ),
 * extraídos das telas reais (ver `docs/portais/caixa-sicaq.md`).
 *
 * Este é o arquivo que a extensão consulta na hora de preencher um `<select>`
 * do portal: sem ele, o preenchimento viraria casamento de texto visível, que
 * quebra a cada acento trocado ou rótulo reescrito pelo banco.
 */

/** Valor de domínio sem equivalente no portal — precisa de decisão do operador. */
export const SEM_CODIGO = null;
export type CaixaCode = string | typeof SEM_CODIGO;

export const CAIXA_SEX: Record<Sex, CaixaCode> = {
  masculino: "M",
  feminino: "F",
};

export const CAIXA_MARITAL_STATUS: Record<MaritalStatus, CaixaCode> = {
  solteiro: "1",
  divorciado: "3",
  separado_judicialmente: "4",
  viuvo: "5",
  casado_comunhao_total: "7",
  casado_separacao_bens: "8",
  casado_comunhao_parcial: "9",
  // O SICAQ não tem "união estável": na prática o cadastro vai como solteiro e
  // o companheiro entra como coproponente. Deixar explícito evita que alguém
  // "conserte" isso mapeando para casado por engano.
  uniao_estavel: SEM_CODIGO,
};

export const CAIXA_EDUCATION_LEVEL: Record<EducationLevel, CaixaCode> = {
  fundamental_ate_4a_incompleto: "02",
  fundamental_4a_completo: "03",
  fundamental_5a_8a_incompleto: "04",
  fundamental_completo: "05",
  medio_incompleto: "06",
  medio_completo: "07",
  superior_incompleto: "08",
  superior_completo: "09",
  pos_graduacao: "10",
  mestrado: "11",
  doutorado: "12",
};

export const CAIXA_NATIONALITY: Record<Nationality, CaixaCode> = {
  brasileiro: "BRASILEIRO",
  brasileiro_naturalizado: "BRASILEIRO_NATURALIZADO",
  brasileiro_nascido_exterior: "BRASILEIRO_NASCIDO_EXTERIOR",
  estrangeiro: "ESTRANGEIRO",
};

/**
 * Documento de identificação no SICAQ.
 *
 * Escolher o tipo não muda só um código: o portal **troca o grupo inteiro de
 * campos**, com nomes sufixados pelo tipo (`identidadeNumeroRg`,
 * `identidadeNumeroCnh`, `identidadeNumeroPassaporte`…). Por isso o mapa carrega
 * os nomes junto — a extensão precisa selecionar o tipo primeiro, esperar o
 * portal redesenhar o bloco e só então preencher os campos certos.
 *
 * `extras` são os campos que existem só naquele tipo.
 */
export interface CaixaDocumentProfile {
  tipo: CaixaCode;
  subtipo: CaixaCode;
  campos: {
    numero: string;
    orgaoEmissor: string;
    uf: string;
    dataEmissao: string;
    dataValidade: string;
    subtipo?: string;
  };
  extras?: Record<string, string>;
}

export const CAIXA_ID_DOCUMENT: Record<IdDocumentType, CaixaDocumentProfile> = {
  rg: {
    tipo: "0372008",
    subtipo: "CI",
    campos: {
      numero: "identidadeNumeroRg",
      orgaoEmissor: "cmbOrgaoEmissorRg",
      uf: "cmbUFIdentidadeRg",
      dataEmissao: "dataEmissaoIdentidadeRg",
      dataValidade: "dataFimValidadeRg",
      subtipo: "subTipoIdentidadeNumeroRg",
    },
  },
  // RIC reaproveita os nomes do RG, sem o subtipo — e o número aceita 11
  // caracteres em vez de 15.
  ric: {
    tipo: "0372102",
    subtipo: SEM_CODIGO,
    campos: {
      numero: "identidadeNumeroRg",
      orgaoEmissor: "cmbOrgaoEmissorRg",
      uf: "cmbUFIdentidadeRg",
      dataEmissao: "dataEmissaoIdentidadeRg",
      dataValidade: "dataFimValidadeRg",
    },
  },
  passaporte: {
    tipo: "0781",
    subtipo: SEM_CODIGO,
    campos: {
      numero: "identidadeNumeroPassaporte",
      orgaoEmissor: "cmbOrgaoEmissorPassaporte",
      uf: "cmbUFIdentidadePassaporte",
      dataEmissao: "dataEmissaoIdentidadePassaporte",
      dataValidade: "dataFimValidadePassaporte",
    },
    extras: { paisDeOrigem: "paisDeOrigemPassaporte" },
  },
  cnh: {
    tipo: "0782",
    subtipo: SEM_CODIGO,
    campos: {
      numero: "identidadeNumeroCnh",
      orgaoEmissor: "cmbOrgaoEmissorCnh",
      uf: "cmbUFIdentidadeCnh",
      dataEmissao: "dataEmissaoIdentidadeCnh",
      dataValidade: "dataFimValidadeCnh",
    },
    extras: { primeiraHabilitacao: "dataPrimeiraHabilitacaoCnh" },
  },
};

/** Órgãos emissores aceitos por tipo de documento (listas do próprio portal). */
export const CAIXA_ORGAO_EMISSOR: Record<IdDocumentType, { codigo: string; nome: string }[]> = {
  rg: [
    { codigo: "10", nome: "SECRETARIA DE SEGURANÇA PÚBLICA" },
    { codigo: "81", nome: "OUTRO TIPO DE ÓRGÃO EMISSOR" },
    { codigo: "88", nome: "SECRETARIA DEFESA SOCIAL" },
    { codigo: "90", nome: "POLÍCIA CIVIL" },
    { codigo: "91", nome: "SECRETARIA DE ESTADO DA CASA CIVIL" },
  ],
  // O portal troca a lista do mesmo campo quando o tipo é RIC (conferido na
  // tela real, fixture `cadastro-de-clientes-10-ric.html`).
  ric: [
    { codigo: "40", nome: "MINISTÉRIO DA JUSTIÇA" },
    { codigo: "95", nome: "OUTRO TIPO DE ÓRGÃO EMISSOR DE RIC" },
  ],
  passaporte: [
    { codigo: "44", nome: "POLÍCIA FEDERAL" },
    { codigo: "82", nome: "ÓRGÃO EMISSOR ESTRANGEIRO" },
  ],
  cnh: [{ codigo: "83", nome: "ÓRGÃO DE TRÂNSITO" }],
};

/**
 * Campo que só aparece quando a nacionalidade é estrangeira. A lista de países
 * (336 opções) é tabela de referência do portal e ainda não foi importada.
 */
export const CAIXA_PAIS_NACIONALIDADE_FIELD = "cmbPaisDeNacionalidade";

export const CAIXA_PROPERTY_TYPE: Record<PropertyType, CaixaCode> = {
  casa: "01",
  sitio: "03",
  chacara: "04",
  apartamento: "05",
  fazenda: "08",
  outro: "10",
};

export const CAIXA_HOUSING_SITUATION: Record<HousingSituation, CaixaCode> = {
  propria_quitada: "01",
  propria_financiada_caixa: "02",
  propria_financiada_outras: "03",
  alugada: "04",
  mora_com_pais: "05",
  cedida: "06",
  funcional: "07",
  outro: "08",
};

export const CAIXA_INCOME_KIND: Record<IncomeKind, CaixaCode> = {
  // `cmbCaracteristicaRenda`: 6 = COMPROVADA. Renda informal é declarada em
  // outra tela do portal, não por este campo.
  formal: "6",
  informal: SEM_CODIGO,
};

export const CAIXA_INCOME_PROOF: Record<IncomeProofType, CaixaCode> = {
  recebimento_exterior: "65220851",
  contracheque: "64522009",
  historico_contracheque: "262903176",
  contrato_aluguel: "64522097",
  contrato_estagio: "64522120",
  declaracao_ir: "64524568",
  declaracao_empregador: "64522404",
  decore: "64524328",
  decore_com_darf: "64522451",
  extrato_aplicacao: "64522484",
  extrato_beneficio_previdenciario: "64522568",
  extrato_conta_salario: "64522614",
  extrato_fgts: "64522635",
  notas_fiscais_rural: "64522681",
  rpa: "65129926",
  recolhimento_iss: "65129980",
  sentenca_judicial: "65130033",
};

/** Código de UF usado em `cmbUFNaturalidade` (IBGE), diferente da sigla. */
export const CAIXA_UF_NATURALIDADE: Record<UF, CaixaCode> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
  MG: "31", ES: "32", RJ: "33", SP: "35",
  PR: "41", SC: "42", RS: "43",
  MS: "50", MT: "51", GO: "52", DF: "53",
};

/**
 * Inverte um mapa de domínio→código para ler a tela do portal de volta para o
 * sistema (o sentido "site → app" da extensão).
 */
export function reverseCaixaMap<T extends string>(map: Record<T, CaixaCode>): Map<string, T> {
  const reversed = new Map<string, T>();
  for (const [value, code] of Object.entries(map) as [T, CaixaCode][]) {
    if (code !== SEM_CODIGO) reversed.set(code, value);
  }
  return reversed;
}
