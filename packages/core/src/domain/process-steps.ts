import type { FieldBlock, StageRequirement } from "../fields/types";
import type { Modality, ProcessStage } from "./process";

/**
 * Etapas do processo, por modalidade.
 *
 * É o único conceito de "onde o processo está": o Kanban tem uma coluna por
 * etapa, o cabeçalho do processo move a etapa e o histórico registra cada
 * movimento. O roteiro muda com a modalidade: construção tem engenheiro local,
 * projeto na prefeitura e PEPT; imóvel usado vai direto do SICAQ à vistoria;
 * empréstimo com garantia não tem vendedor nem ITBI.
 *
 * `phase` é só agrupamento interno: diz qual tela de campos do fluxo do
 * escritório (`flow_stages`) e qual checklist de documentos valem na etapa.
 * Não aparece para o operador.
 *
 * As chaves são comuns entre as modalidades: trocar a modalidade de um processo
 * mantém a etapa em que ele está sempre que ela existir no novo roteiro.
 */

export type StepSystem = "SICAQ" | "SIOPI" | "SICTD";

export interface ProcessStepDef {
  key: string;
  label: string;
  phase: ProcessStage;
  /** Quem costuma ter a próxima ação. Texto livre: é orientação, não permissão. */
  responsible: string;
  system?: StepSystem;
  /**
   * Etapa que só acontece quando algo dá errado (score condicionado, PEPT,
   * pendência de conformidade). Ao concluir, o processo volta a `returnsTo`.
   */
  conditional?: boolean;
  returnsTo?: string;
  hint?: string;
  /**
   * Campos próprios da etapa. Sem isto, a etapa mostra a tela de campos da
   * fase no fluxo do escritório; com isto, mostra estes, para uma etapa com
   * campos que nenhuma outra usa.
   */
  blocks?: FieldBlock[];
  /** Roteiro curto do que se faz na etapa, mostrado no topo dela. */
  todo?: string[];
  /** O que conclui a etapa. */
  doneWhen?: string;
  /**
   * Documentos que a etapa pede. Sem isto, vale o checklist da fase no fluxo
   * do escritório.
   */
  requirements?: StageRequirement[];
}

type StepCatalog = Record<string, Omit<ProcessStepDef, "key">>;

// ── Campos e documentos de cada etapa ────────────────────────────────────
// Cada etapa mostra só o que se preenche nela. A visão completa do processo é
// o PDF "Resumo do processo".

const req = (documentType: string, required = true, note?: string): StageRequirement =>
  note ? { documentType, required, note } : { documentType, required };

const DOCS_PESSOAIS: StageRequirement[] = [
  req("rg", true, "RG ou CNH de cada participante."),
  req("comprovante_residencia"),
  req("comprovante_renda"),
  req("certidao_casamento", false, "Ou de nascimento, conforme o estado civil."),
  req("extrato_fgts", false, "Quando houver uso de FGTS."),
  req("declaracao_ir", false, "Quando a renda for comprovada por IR."),
];

const DOCS_IMOVEL: StageRequirement[] = [
  req("matricula_imovel", true, "Atualizada."),
  req("iptu", false),
  req("documento_vendedor"),
  req("contrato_compra_venda", false),
];

const BLOCO_IMOVEL = (title: string, extra: string[] = []): FieldBlock => ({
  key: "imovel",
  title,
  fields: [
    "process.property_value",
    "process.property_address",
    "process.property_registration",
    ...extra,
  ],
});

const BLOCO_PARCEIROS: FieldBlock = {
  key: "parceiros",
  title: "Quem trouxe o negócio",
  fields: ["process.real_estate_agency", "process.broker"],
};

const BLOCO_REGISTRO: FieldBlock = {
  key: "registro",
  title: "Registro em cartório",
  fields: ["cri.fees_paid_at", "cri.protocol_number", "cri.protocol_at", "cri.registered_at"],
};

const BLOCO_CONFORMIDADE: FieldBlock = {
  key: "conformidade",
  title: "Conformidade",
  fields: ["compliance.occurred_at", "compliance.notes"],
};

const STEPS = {
  documentacao_pessoal: {
    label: "Documentação pessoal e dados cadastrais",
    phase: "cadastro",
    responsible: "Cliente e escritório",
    todo: [
      "Juntar os documentos de cada participante.",
      "Completar o cadastro de cada pessoa para a ficha do SICAQ.",
      "Definir modalidade e agência.",
    ],
    doneWhen: "Todos os participantes com os documentos obrigatórios e o cadastro completo.",
    blocks: [
      {
        key: "proposta",
        title: "Negócio",
        description: "Valores pretendidos: os definitivos entram na proposta do SIOPI.",
        fields: [
          "process.modality",
          "process.bank",
          "process.agency",
          "process.property_value",
          "process.financed_value",
        ],
      },
      {
        key: "parceiros",
        title: "Parceiros e responsável",
        fields: [
          "process.real_estate_agency",
          "process.broker",
          "process.assigned_to",
          "process.notes",
        ],
      },
    ],
    requirements: DOCS_PESSOAIS,
  },
  analise_risco: {
    label: "Avaliação de risco",
    phase: "correspondente",
    responsible: "Escritório",
    system: "SICAQ",
    hint: "Resultado: aprovado, condicionado ou reprovado.",
    todo: ["Enviar a ficha no SICAQ.", "Registrar o resultado e as condições aprovadas."],
    doneWhen: "Avaliação aprovada vinculada. Condicionada ou reprovada abre a evolução de score.",
    blocks: [
      {
        key: "analise",
        title: "Resultado da avaliação",
        fields: [
          "credit.authorization_type",
          "credit.analysis_status",
          "process.credit_valid_until",
          "credit.fgts_three_years",
        ],
      },
      {
        key: "calculo",
        title: "Condições aprovadas",
        fields: [
          "process.approved_value",
          "process.term_months",
          "credit.installment_value",
          "process.subsidy",
          "process.fgts",
        ],
      },
      {
        key: "observacoes",
        title: "Observações",
        fields: ["credit.analysis_notes"],
      },
    ],
    requirements: [req("ficha_cadastral_banco", false)],
  },
  evolucao_score: {
    label: "Evolução de crédito/score",
    phase: "correspondente",
    responsible: "Cliente e escritório",
    conditional: true,
    returnsTo: "analise_risco",
    hint: "Só quando a avaliação volta condicionada ou reprovada.",
    todo: [
      "Orientar o cliente: quitar dívida, compor renda ou trocar o enquadramento.",
      "Reenviar a avaliação quando estiver pronto.",
    ],
    doneWhen: "Reenviado: volta para a Avaliação de risco.",
    blocks: [
      {
        key: "analise",
        title: "Situação da avaliação",
        fields: ["credit.analysis_status", "credit.analysis_notes"],
      },
    ],
  },
  escolha_imovel: {
    label: "Escolha do imóvel",
    phase: "correspondente",
    responsible: "Cliente",
    todo: [
      "Cliente escolhe o imóvel dentro do valor aprovado.",
      "Levantar os dados do imóvel e os documentos do vendedor.",
    ],
    doneWhen: "Imóvel definido, com matrícula e documentos do vendedor.",
    blocks: [BLOCO_IMOVEL("Imóvel", ["process.builder", "process.development"]), BLOCO_PARCEIROS],
    requirements: DOCS_IMOVEL,
  },
  escolha_terreno: {
    label: "Escolha do terreno",
    phase: "correspondente",
    responsible: "Cliente",
    todo: [
      "Cliente escolhe o terreno dentro do valor aprovado.",
      "Levantar os dados do terreno e os documentos do vendedor.",
    ],
    doneWhen: "Terreno definido, com matrícula.",
    blocks: [BLOCO_IMOVEL("Terreno"), BLOCO_PARCEIROS],
    requirements: DOCS_IMOVEL,
  },
  escolha_terreno_engenheiro: {
    label: "Escolha do terreno e do engenheiro local",
    phase: "correspondente",
    responsible: "Cliente",
    hint: "Muitas vezes já vêm definidos pelo corretor ou engenheiro parceiro.",
    todo: [
      "Cliente escolhe o terreno dentro do valor aprovado.",
      "Definir o engenheiro local que vai projetar e construir.",
    ],
    doneWhen: "Terreno e engenheiro definidos.",
    blocks: [BLOCO_IMOVEL("Terreno"), BLOCO_PARCEIROS],
    requirements: DOCS_IMOVEL,
  },
  escolha_engenheiro: {
    label: "Escolha do engenheiro local",
    phase: "correspondente",
    responsible: "Cliente",
    todo: ["Definir o engenheiro local que vai projetar e construir no terreno do cliente."],
    doneWhen: "Engenheiro definido.",
    blocks: [
      {
        key: "terreno",
        title: "Terreno do cliente",
        fields: ["process.property_address", "process.property_registration"],
      },
    ],
    requirements: [req("matricula_imovel", true, "Do terreno, atualizada.")],
  },
  projeto_prefeitura: {
    label: "Projeto de engenharia e aprovação na prefeitura",
    phase: "correspondente",
    responsible: "Engenheiro local",
    todo: ["Engenheiro faz o projeto e aprova na prefeitura."],
    doneWhen: "Alvará emitido.",
  },
  documentacao_engenharia: {
    label: "Entrega da documentação de engenharia",
    phase: "correspondente",
    responsible: "Engenheiro local",
    todo: ["Engenheiro entrega à Caixa orçamento, cronograma, memorial descritivo e ART/RRT."],
    doneWhen: "Pacote completo entregue.",
  },
  taxa_engenharia: {
    label: "Pagamento da taxa de engenharia",
    phase: "correspondente",
    responsible: "Cliente",
    hint: "Boleto: condição para a Caixa convocar a vistoria.",
    todo: ["Enviar o boleto ao cliente e confirmar o pagamento."],
    doneWhen: "Taxa paga.",
  },
  vistoria_engenharia: {
    label: "Vistoria da engenharia Caixa",
    phase: "correspondente",
    responsible: "Engenharia Caixa",
    system: "SIOPI",
    hint: "Reprovação não encerra o processo: dá para ajustar e tentar de novo.",
    todo: ["Acompanhar a vistoria no SIOPI.", "Registrar o valor do laudo."],
    doneWhen: "Laudo aprovado.",
    blocks: [{ key: "laudo", title: "Laudo", fields: ["credit.appraisal_value"] }],
    requirements: [req("laudo_avaliacao")],
  },
  avaliacao_garantia: {
    label: "Avaliação do imóvel em garantia",
    phase: "correspondente",
    responsible: "Engenharia Caixa",
    system: "SIOPI",
    todo: ["Acompanhar a vistoria do imóvel que o cliente já tem.", "Registrar o laudo."],
    doneWhen: "Laudo aprovado.",
    blocks: [
      {
        key: "imovel",
        title: "Imóvel em garantia",
        fields: [
          "process.property_address",
          "process.property_registration",
          "credit.appraisal_value",
          "credit.outstanding_balance",
        ],
      },
    ],
    requirements: [req("matricula_imovel"), req("iptu", false), req("laudo_avaliacao")],
  },
  ajustes_pept: {
    label: "Ajustes de projeto (PEPT)",
    phase: "correspondente",
    responsible: "Engenheiro local",
    conditional: true,
    returnsTo: "vistoria_engenharia",
    hint: "Só quando a engenharia Caixa pede ajuste no projeto.",
    todo: ["Engenheiro ajusta o que a Caixa apontou e pede nova vistoria."],
    doneWhen: "Ajustes entregues: volta para a Vistoria.",
  },
  proposta_siopi: {
    label: "Criação da proposta e dados do contrato",
    phase: "montagem",
    responsible: "Escritório",
    system: "SIOPI",
    todo: ["Criar a proposta no SIOPI.", "Gerar os formulários para assinatura em Gerar PDF."],
    doneWhen: "Proposta criada no SIOPI.",
    blocks: [
      {
        key: "proposta",
        title: "Proposta",
        fields: [
          "process.proposal_number",
          "process.amortization",
          "process.indexer",
          "process.term_months",
          "process.financed_value",
          "process.fgts",
          "process.subsidy",
        ],
      },
      {
        key: "conta",
        title: "Conta corrente",
        fields: [
          "process.checking_agency",
          "process.checking_operation",
          "process.checking_account_number",
          "process.checking_dv",
        ],
      },
      {
        key: "comercial",
        title: "Produtos bancários",
        fields: [
          "assembly.origin",
          "assembly.checking_account",
          "assembly.overdraft_value",
          "assembly.savings_account",
          "assembly.credit_card",
        ],
      },
    ],
  },
  envio_conformidade: {
    label: "Envio para conformidade",
    phase: "conformidade_contrato",
    responsible: "Escritório",
    system: "SICTD",
    hint: "Documentos pessoais, do imóvel e formulários assinados.",
    todo: [
      "Montar o dossiê com formulários assinados, documentos pessoais, do imóvel e laudo.",
      "Enviar pelo SICTD.",
    ],
    doneWhen: "Conformidade aprovada. Pendência abre a correção.",
    blocks: [BLOCO_CONFORMIDADE],
  },
  pendencias_conformidade: {
    label: "Correção de pendências da conformidade",
    phase: "conformidade_contrato",
    responsible: "Escritório",
    system: "SICTD",
    conditional: true,
    returnsTo: "envio_conformidade",
    hint: "Só quando a conformidade aponta pendência.",
    todo: ["Corrigir o que a conformidade apontou e reenviar."],
    doneWhen: "Reenviado: volta para o Envio para conformidade.",
    blocks: [BLOCO_CONFORMIDADE],
  },
  revisao_gerente: {
    label: "Revisão final pelo gerente da agência",
    phase: "agencia",
    responsible: "Gerente da agência",
    system: "SIOPI",
    todo: ["Gerente revisa a proposta e faz a entrevista com o cliente."],
    doneWhen: "Gerente aprovou.",
    blocks: [
      {
        key: "entrevista",
        title: "Entrevista",
        fields: ["agency.manager_name", "agency.interview_at", "agency.interview_done"],
      },
    ],
  },
  contrato_agendamento: {
    label: "Geração do contrato e agendamento da assinatura",
    phase: "agencia",
    responsible: "Escritório",
    system: "SIOPI",
    todo: ["Gerar o contrato.", "Marcar a assinatura com o cliente e o vendedor."],
    doneWhen: "Assinatura marcada.",
    blocks: [
      {
        key: "contrato",
        title: "Contrato",
        fields: ["process.contract_number", "agency.signature_forecast"],
      },
    ],
  },
  assinatura: {
    label: "Assinatura do contrato",
    phase: "agencia",
    responsible: "Cliente (e vendedor, quando houver)",
    todo: ["Cliente (e vendedor) assinam o contrato na agência."],
    doneWhen: "Contrato assinado.",
    blocks: [
      {
        key: "assinatura",
        title: "Assinatura",
        fields: ["agency.signed_at", "agency.contract_signed", "agency.used_value"],
      },
    ],
  },
  itbi: {
    label: "Recolhimento do ITBI e encargos de transferência",
    phase: "cri",
    responsible: "Cliente",
    hint: "Na prefeitura.",
    todo: ["Cliente emite e paga a guia do ITBI na prefeitura."],
    doneWhen: "ITBI pago.",
  },
  registro_cartorio: {
    label: "Registro em cartório de imóveis",
    phase: "cri",
    responsible: "Cliente",
    todo: ["Cliente leva o contrato ao cartório e paga os emolumentos."],
    doneWhen: "Registro finalizado.",
    blocks: [BLOCO_REGISTRO],
  },
  registro_garantia: {
    label: "Registro da garantia em cartório",
    phase: "cri",
    responsible: "Cliente",
    hint: "Alienação fiduciária sobre o imóvel que o cliente já tem.",
    todo: ["Cliente leva o contrato ao cartório para registrar a alienação fiduciária."],
    doneWhen: "Registro finalizado.",
    blocks: [BLOCO_REGISTRO],
  },
  envio_matricula: {
    label: "Envio do contrato e da matrícula atualizada",
    phase: "cri",
    responsible: "Escritório",
    system: "SICTD",
    hint: "Confirma a garantia: última etapa acompanhada aqui.",
    todo: ["Enviar à Caixa o contrato registrado e a matrícula atualizada."],
    doneWhen: "Enviado: processo concluído.",
    requirements: [req("matricula_imovel", true, "Já com o registro do contrato.")],
  },
} satisfies StepCatalog;

type StepKey = keyof typeof STEPS;

const INICIO: StepKey[] = ["documentacao_pessoal", "analise_risco", "evolucao_score"];

const CONTRATACAO: StepKey[] = [
  "proposta_siopi",
  "envio_conformidade",
  "pendencias_conformidade",
  "revisao_gerente",
  "contrato_agendamento",
];

/**
 * Roteiros. Construção é o mais completo; os demais são recortes dele, como
 * no mapeamento feito com o escritório.
 */
export const STEP_TRACKS = {
  terreno_construcao: {
    name: "Terreno + construção",
    steps: [
      ...INICIO,
      "escolha_terreno_engenheiro",
      "projeto_prefeitura",
      "documentacao_engenharia",
      "taxa_engenharia",
      "vistoria_engenharia",
      "ajustes_pept",
      ...CONTRATACAO,
      "assinatura",
      "itbi",
      "registro_cartorio",
      "envio_matricula",
    ],
  },
  construcao_terreno_proprio: {
    name: "Construção em terreno próprio",
    steps: [
      ...INICIO,
      "escolha_engenheiro",
      "projeto_prefeitura",
      "documentacao_engenharia",
      "taxa_engenharia",
      "vistoria_engenharia",
      "ajustes_pept",
      ...CONTRATACAO,
      "assinatura",
      "registro_cartorio",
      "envio_matricula",
    ],
  },
  aquisicao_terreno: {
    name: "Aquisição de terreno",
    steps: [
      ...INICIO,
      "escolha_terreno",
      "vistoria_engenharia",
      ...CONTRATACAO,
      "assinatura",
      "itbi",
      "registro_cartorio",
      "envio_matricula",
    ],
  },
  aquisicao_imovel: {
    name: "Aquisição de imóvel",
    steps: [
      ...INICIO,
      "escolha_imovel",
      "vistoria_engenharia",
      ...CONTRATACAO,
      "assinatura",
      "itbi",
      "registro_cartorio",
      "envio_matricula",
    ],
  },
  emprestimo_garantia: {
    name: "Empréstimo com garantia de imóvel",
    steps: [
      ...INICIO,
      "avaliacao_garantia",
      ...CONTRATACAO,
      "assinatura",
      "registro_garantia",
      "envio_matricula",
    ],
  },
} as const satisfies Record<string, { name: string; steps: StepKey[] }>;

export type StepTrack = keyof typeof STEP_TRACKS;

export const MODALITY_TRACK: Record<Modality, StepTrack> = {
  aquisicao_imovel_novo: "aquisicao_imovel",
  aquisicao_imovel_usado: "aquisicao_imovel",
  aquisicao_terreno: "aquisicao_terreno",
  aquisicao_terreno_construcao: "terreno_construcao",
  construcao: "construcao_terreno_proprio",
  reforma_ampliacao: "construcao_terreno_proprio",
  emprestimo_garantia_imovel: "emprestimo_garantia",
  // Quem assume o financiamento compra um imóvel com vendedor, vistoria e ITBI.
  transferencia_financiamento: "aquisicao_imovel",
};

/**
 * Sem modalidade ainda (processo recém-aberto), vale o roteiro de aquisição:
 * as primeiras etapas são as mesmas em todas, e é o caso mais comum.
 */
const FALLBACK_TRACK: StepTrack = "aquisicao_imovel";

export function trackForModality(modality: Modality | null | undefined): StepTrack {
  return modality ? MODALITY_TRACK[modality] : FALLBACK_TRACK;
}

export function stepsForModality(modality: Modality | null | undefined): ProcessStepDef[] {
  return STEP_TRACKS[trackForModality(modality)].steps.map((key) => ({
    key,
    ...STEPS[key],
  }));
}

/**
 * Todas as etapas, na ordem do funil. É a ordem das colunas do Kanban quando
 * ele mostra processos de modalidades diferentes juntos.
 */
export const STEP_ORDER: ProcessStepDef[] = Object.entries(STEPS as StepCatalog).map(
  ([key, def]) => ({ key, ...def }),
);

/**
 * Etapas que deixaram de existir. O histórico guarda a chave, e um evento
 * antigo precisa continuar legível.
 */
const RETIRED_STEP_LABELS: Record<string, string> = {
  simulacao: "Simulação",
  captacao: "Captação do cliente",
  definicao_simulacao: "Definição da simulação",
};

/** Rótulo de qualquer etapa, para o histórico — que guarda só a chave. */
export function stepLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return (STEPS as StepCatalog)[key]?.label ?? RETIRED_STEP_LABELS[key] ?? key;
}

/**
 * Etapa em que o processo está.
 *
 * A chave gravada vale quando existe no roteiro da modalidade atual. Senão —
 * processo anterior às etapas por modalidade, ou modalidade trocada para uma sem
 * aquela etapa — cai na primeira etapa da fase em que o processo está, que é a melhor
 * pista do quanto ele já andou.
 */
export function resolveCurrentStep(
  steps: ProcessStepDef[],
  stepKey: string | null | undefined,
  stage: ProcessStage,
): ProcessStepDef {
  const stored = steps.find((step) => step.key === stepKey);
  if (stored) return stored;
  const first = steps[0];
  if (!first) throw new Error("Roteiro sem etapas.");
  return steps.find((step) => step.phase === stage && !step.conditional) ?? first;
}

/**
 * Próxima etapa da sequência normal: pula os condicionais, que só se abrem
 * por escolha do operador. Uma etapa condicional volta para o que o originou.
 */
export function nextStep(steps: ProcessStepDef[], current: ProcessStepDef): ProcessStepDef | null {
  if (current.conditional && current.returnsTo) {
    return steps.find((step) => step.key === current.returnsTo) ?? null;
  }
  const index = steps.findIndex((step) => step.key === current.key);
  return steps.slice(index + 1).find((step) => !step.conditional) ?? null;
}

/** Desvios que podem ser abertos a partir da etapa atual (ex.: PEPT após a vistoria). */
export function detoursFrom(steps: ProcessStepDef[], current: ProcessStepDef): ProcessStepDef[] {
  return steps.filter((step) => step.conditional && step.returnsTo === current.key);
}

/** Primeira etapa de uma fase: onde caem processos anteriores às etapas. */
export function firstStepOfPhase(
  steps: ProcessStepDef[],
  phase: ProcessStage,
): ProcessStepDef | undefined {
  return steps.find((step) => step.phase === phase && !step.conditional);
}
