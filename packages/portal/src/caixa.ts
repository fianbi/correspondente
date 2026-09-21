import { portais } from "@corr/core";
import type { FieldMapping, PortalProfile, ScreenProfile } from "./types";

/**
 * Perfil do Caixa Aqui (SICAQ), montado a partir do mapa de campos em
 * `docs/portais/caixa-sicaq.md`.
 *
 * As chaves de dado (`person.*`) são as do cadastro do sistema. O que muda de
 * portal para portal é só este arquivo — o motor e o cadastro não sabem que a
 * Caixa existe.
 */

const doc = portais.CAIXA_ID_DOCUMENT;

/**
 * O portal troca o grupo inteiro de campos conforme o tipo de documento, com
 * nomes sufixados. Cada grupo entra condicionado ao tipo selecionado: sem
 * isso, o preenchimento escreveria no campo de RG enquanto a tela mostra CNH.
 */
function documentMappings(): FieldMapping[] {
  const mappings: FieldMapping[] = [];

  for (const [tipo, perfil] of Object.entries(doc)) {
    const when = { selector: '[name="cmbTipoDocumento"]', equals: String(perfil.tipo) };

    mappings.push(
      { dataKey: "person.docNumber", selector: `[name="${perfil.campos.numero}"]`, when },
      { dataKey: "person.docIssuer", selector: `[name="${perfil.campos.orgaoEmissor}"]`, when },
      { dataKey: "person.docIssuerUf", selector: `[name="${perfil.campos.uf}"]`, when },
      {
        dataKey: "person.docIssuedAt",
        selector: `[name="${perfil.campos.dataEmissao}"]`,
        transform: "date_br",
        when,
      },
      {
        dataKey: "person.docValidUntil",
        selector: `[name="${perfil.campos.dataValidade}"]`,
        transform: "date_br",
        when,
      },
    );

    if (tipo === "cnh" && perfil.extras?.primeiraHabilitacao) {
      mappings.push({
        dataKey: "person.docFirstLicenseDate",
        selector: `[name="${perfil.extras.primeiraHabilitacao}"]`,
        transform: "date_br",
        when,
      });
    }

    if (tipo === "passaporte" && perfil.extras?.paisDeOrigem) {
      mappings.push({
        dataKey: "person.docIssuerCountry",
        selector: `[name="${perfil.extras.paisDeOrigem}"]`,
        when,
      });
    }
  }

  return mappings;
}

const DADOS_CADASTRAIS: ScreenProfile = {
  key: "cadastro_dados",
  label: "Cadastro de clientes — dados cadastrais",
  urlHint: "cadastro_cliente",
  marker: '[name="nomeCompleto"]',
  mappings: [
    { dataKey: "person.cpf", selector: '[name="dataCpf"]', transform: "digits" },
    { dataKey: "person.fullName", selector: '[name="nomeCompleto"]', transform: "upper" },
    { dataKey: "person.shortName", selector: '[name="nomeReduzido"]', transform: "upper" },
    { dataKey: "person.birthDate", selector: '[name="dataNascimento"]', transform: "date_br" },
    { dataKey: "person.sex", selector: '[name="cmbSexo"]' },
    { dataKey: "person.nationality", selector: '[name="cmbNacionalidade"]' },
    { dataKey: "person.birthUf", selector: '[name="cmbUFNaturalidade"]' },
    { dataKey: "person.birthCity", selector: '[name="cmbMunicipioNaturalidade"]' },
    { dataKey: "person.fatherName", selector: '[name="nomePai"]', transform: "upper" },
    { dataKey: "person.motherName", selector: '[name="nomeMae"]', transform: "upper" },
    { dataKey: "person.educationLevel", selector: '[name="cmbGrauInstrucao"]' },
    { dataKey: "person.pis", selector: '[name="pis"]', transform: "digits" },
    { dataKey: "person.docType", selector: '[name="cmbTipoDocumento"]' },
    ...documentMappings(),
    { dataKey: "person.maritalStatus", selector: '[name="cmbEstadoCivil"]' },
    { dataKey: "person.spouseCpf", selector: '[name="cpfConjuge"]', transform: "digits" },
    {
      dataKey: "person.spouseName",
      selector: '[name="nomeCompletoConjuge"]',
      transform: "upper",
    },
    {
      dataKey: "person.nationalityCountry",
      selector: `[name="${portais.CAIXA_PAIS_NACIONALIDADE_FIELD}"]`,
      when: { selector: '[name="cmbNacionalidade"]', equals: "ESTRANGEIRO" },
    },
  ],
};

const ENDERECO: ScreenProfile = {
  key: "cadastro_endereco",
  label: "Cadastro de clientes — endereço e contato",
  urlHint: "cadastro_cliente",
  marker: '[name="cep"]',
  mappings: [
    { dataKey: "person.zipCode", selector: '[name="cep"]', transform: "digits" },
    { dataKey: "person.streetType", selector: '[name="cmbTipoLogradouro"]' },
    { dataKey: "person.street", selector: '[name="logradouro"]', transform: "upper" },
    { dataKey: "person.streetNumber", selector: '[name="numero"]' },
    { dataKey: "person.complement", selector: '[name="complemento"]', transform: "upper" },
    { dataKey: "person.district", selector: '[name="bairro"]', transform: "upper" },
    { dataKey: "person.uf", selector: '[name="cmbUFEndereco"]' },
    { dataKey: "person.city", selector: '[name="cmbMunicipioEndereco"]' },
    { dataKey: "person.propertyType", selector: '[name="cmbTipoImovel"]' },
    { dataKey: "person.housingSituation", selector: '[name="cmbTipoOcupacaoImovel"]' },
    { dataKey: "person.residenceProofMonth", selector: '[name="comprovanteResidenciaMes"]' },
    { dataKey: "person.residenceProofYear", selector: '[name="comprovanteResidenciaAno"]' },
    { dataKey: "person.phone", selector: '[name="dddCel"]', transform: "phone_ddd" },
    { dataKey: "person.phone", selector: '[name="telefoneCel"]', transform: "phone_number" },
    { dataKey: "person.email", selector: '[name="email"]', transform: "upper" },
  ],
};

const PESQUISA: ScreenProfile = {
  key: "pesquisa_cadastral",
  label: "Pesquisa cadastral simplificada",
  urlHint: "pesquisa",
  marker: '[name="respostaCaptcha"]',
  // Só o CPF: o captcha é resolvido pelo operador, e é justamente por isso que
  // esta tela fica fora do caminho de cadastro.
  mappings: [{ dataKey: "person.cpf", selector: '[name="dataCpf"]', transform: "digits" }],
};

/**
 * Renda formal — uma ocorrência por fonte pagadora.
 *
 * Diferente das outras telas, esta não preenche com dados da pessoa e sim de
 * UMA renda dela: o portal cadastra uma fonte por vez, então o painel pergunta
 * qual antes de preencher.
 */
const RENDA_FORMAL: ScreenProfile = {
  key: "renda_formal",
  label: "Cadastro de clientes — renda formal",
  urlHint: "cadastro_cliente",
  marker: '[name="valorRendaBruta"]',
  needsIncome: true,
  mappings: [
    { dataKey: "income.kind", selector: '[name="cmbCaracteristicaRenda"]' },
    { dataKey: "income.sourceKind", selector: '[name="cmbCnpj_cpf"]' },
    {
      dataKey: "income.sourceDocument",
      selector: '[name="numeroCnpj"]',
      when: { selector: '[name="cmbCnpj_cpf"]', equals: "2" },
    },
    {
      dataKey: "income.sourceDocument",
      selector: '[name="numeroCpf"]',
      when: { selector: '[name="cmbCnpj_cpf"]', equals: "1" },
    },
    { dataKey: "income.sourceName", selector: '[name="fontePagadora"]', transform: "upper" },
    { dataKey: "income.occupation", selector: '[name="cmbOcupacao"]' },
    { dataKey: "income.startDate", selector: '[name="dataAdmissao"]', transform: "date_br" },
    { dataKey: "income.grossCents", selector: '[name="valorRendaBruta"]', transform: "money_br" },
    { dataKey: "income.netCents", selector: '[name="valorRendaLiquida"]', transform: "money_br" },
    { dataKey: "income.proofType", selector: '[name="cmbComprovanteRenda"]' },
    { dataKey: "income.proofReference", selector: '[name="dtRefCompr"]' },
    { dataKey: "income.previousJobYears", selector: '[name="empregoAnos"]' },
    { dataKey: "income.previousJobMonths", selector: '[name="empregoMeses"]' },
  ],
};

const RENDA_INFORMAL: ScreenProfile = {
  key: "renda_informal",
  label: "Cadastro de clientes — renda informal",
  urlHint: "cadastro_cliente",
  marker: '[name="rendaLiquidaMensal"]',
  needsIncome: true,
  mappings: [
    { dataKey: "income.sourceName", selector: '[name="nomeAtividade"]', transform: "upper" },
    { dataKey: "income.startDate", selector: '[name="dataDeInicio"]', transform: "date_br" },
    {
      dataKey: "income.netCents",
      selector: '[name="rendaLiquidaMensal"]',
      transform: "money_br",
    },
  ],
};

const AGENCIA: ScreenProfile = {
  key: "agencia_relacionamento",
  label: "Cadastro de clientes — agência de relacionamento",
  urlHint: "cadastro_cliente",
  marker: '[name="cmbAgenciaRelacionamento"]',
  mappings: [
    { dataKey: "agency.uf", selector: '[name="cmbUFAgenciaRelacionamento"]' },
    { dataKey: "agency.city", selector: '[name="cmbMunicipioAgenciaRelacionamento"]' },
    { dataKey: "agency.number", selector: '[name="cmbAgenciaRelacionamento"]' },
  ],
};

export const CAIXA_PROFILE: PortalProfile = {
  key: "caixa_aqui",
  label: "Caixa Aqui (SICAQ)",
  hostPattern: "caixa.gov.br",
  screens: [DADOS_CADASTRAIS, ENDERECO, RENDA_FORMAL, RENDA_INFORMAL, AGENCIA, PESQUISA],
};

/** Valores de domínio traduzidos para os códigos que o portal espera. */
export function toCaixaValues(person: Record<string, unknown>): Record<string, string | null> {
  const texto = (valor: unknown): string | null =>
    valor === null || valor === undefined || valor === "" ? null : String(valor);

  const codigo = <T extends string>(
    mapa: Record<T, portais.CaixaCode>,
    valor: unknown,
  ): string | null => {
    if (!valor) return null;
    const encontrado = mapa[valor as T];
    return encontrado ?? null;
  };

  return {
    "person.cpf": texto(person.cpf),
    "person.fullName": texto(person.fullName),
    "person.shortName": texto(person.shortName),
    "person.birthDate": texto(person.birthDate),
    "person.sex": codigo(portais.CAIXA_SEX, person.sex),
    "person.nationality": codigo(portais.CAIXA_NATIONALITY, person.nationality),
    "person.birthUf": codigo(portais.CAIXA_UF_NATURALIDADE, person.birthUf),
    "person.birthCity": texto(person.birthCity),
    "person.fatherName": texto(person.fatherName),
    "person.motherName": texto(person.motherName),
    "person.educationLevel": codigo(portais.CAIXA_EDUCATION_LEVEL, person.educationLevel),
    "person.pis": texto(person.pis),
    "person.docType": person.docType
      ? String(portais.CAIXA_ID_DOCUMENT[person.docType as keyof typeof portais.CAIXA_ID_DOCUMENT].tipo)
      : null,
    "person.docNumber": texto(person.docNumber),
    "person.docIssuer": texto(person.docIssuer),
    "person.docIssuerUf": texto(person.docIssuerUf),
    "person.docIssuedAt": texto(person.docIssuedAt),
    "person.docValidUntil": texto(person.docValidUntil),
    "person.docFirstLicenseDate": texto(person.docFirstLicenseDate),
    "person.docIssuerCountry": texto(person.docIssuerCountry),
    "person.maritalStatus": codigo(portais.CAIXA_MARITAL_STATUS, person.maritalStatus),
    "person.spouseCpf": texto(person.spouseCpf),
    "person.spouseName": texto(person.spouseName),
    "person.nationalityCountry": texto(person.nationalityCountry),
    "person.zipCode": texto(person.zipCode),
    "person.streetType": texto(person.streetType),
    "person.street": texto(person.street),
    "person.streetNumber": texto(person.streetNumber),
    "person.complement": texto(person.complement),
    "person.district": texto(person.district),
    "person.uf": texto(person.uf),
    "person.city": texto(person.city),
    "person.propertyType": codigo(portais.CAIXA_PROPERTY_TYPE, person.propertyType),
    "person.housingSituation": codigo(portais.CAIXA_HOUSING_SITUATION, person.housingSituation),
    "person.residenceProofMonth": texto(person.residenceProofMonth),
    "person.residenceProofYear": texto(person.residenceProofYear),
    "person.phone": texto(person.phone),
    "person.email": texto(person.email),
  };
}

/**
 * Traduz UMA renda da pessoa para os campos da tela de renda do portal.
 *
 * O tipo de fonte não existe no nosso cadastro: ele é deduzido do documento da
 * fonte pagadora — 14 dígitos é CNPJ, 11 é CPF. Deduzir aqui evita pedir ao
 * operador um dado que já está implícito no que ele digitou.
 */
export function toCaixaIncomeValues(income: Record<string, unknown>): Record<string, string | null> {
  const texto = (valor: unknown): string | null =>
    valor === null || valor === undefined || valor === "" ? null : String(valor);

  const documento = texto(income.sourceDocument)?.replace(/\D+/g, "") ?? null;
  const tipoDeFonte = documento === null ? null : documento.length === 14 ? "2" : "1";

  const mes = income.proofMonth ? String(income.proofMonth).padStart(2, "0") : null;
  const ano = texto(income.proofYear);

  return {
    "income.kind": income.kind
      ? (portais.CAIXA_INCOME_KIND[income.kind as keyof typeof portais.CAIXA_INCOME_KIND] ?? null)
      : null,
    "income.sourceKind": tipoDeFonte,
    "income.sourceDocument": documento,
    "income.sourceName": texto(income.sourceName),
    "income.occupation": texto(income.occupation),
    "income.startDate": texto(income.startDate),
    "income.grossCents": texto(income.grossCents),
    "income.netCents": texto(income.netCents),
    "income.proofType": income.proofType
      ? (portais.CAIXA_INCOME_PROOF[income.proofType as keyof typeof portais.CAIXA_INCOME_PROOF] ??
        null)
      : null,
    // O portal aceita a competência como MM/AAAA num campo só.
    "income.proofReference": mes && ano ? `${mes}/${ano}` : null,
    "income.previousJobYears": texto(income.previousJobYears),
    "income.previousJobMonths": texto(income.previousJobMonths),
  };
}

/** Agência de relacionamento, que vem da agência do processo. */
export function toCaixaAgencyValues(
  agency: { number?: string | null; city?: string | null; uf?: string | null } | null,
): Record<string, string | null> {
  return {
    "agency.number": agency?.number ?? null,
    "agency.city": agency?.city ?? null,
    "agency.uf": agency?.uf ?? null,
  };
}
