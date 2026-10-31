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
}

type StepCatalog = Record<string, Omit<ProcessStepDef, "key">>;

const STEPS = {
  captacao: {
    label: "Captação do cliente",
    phase: "cadastro",
    responsible: "Escritório",
    hint: "Direto ou por indicação de corretor ou engenheiro parceiro.",
  },
  simulacao: {
    label: "Levantamento e simulação de crédito",
    phase: "cadastro",
    responsible: "Escritório",
    hint: "Uma ou mais simulações para o cliente comparar.",
  },
  definicao_simulacao: {
    label: "Definição da simulação",
    phase: "cadastro",
    responsible: "Cliente",
  },
  documentacao_pessoal: {
    label: "Documentação pessoal e dados cadastrais",
    phase: "cadastro",
    responsible: "Cliente e escritório",
  },
  analise_risco: {
    label: "Avaliação de risco",
    phase: "correspondente",
    responsible: "Escritório",
    system: "SICAQ",
    hint: "Resultado: aprovado, condicionado ou reprovado.",
  },
  evolucao_score: {
    label: "Evolução de crédito/score",
    phase: "correspondente",
    responsible: "Cliente e escritório",
    conditional: true,
    returnsTo: "analise_risco",
    hint: "Só quando a avaliação volta condicionada ou reprovada.",
  },
  escolha_imovel: {
    label: "Escolha do imóvel",
    phase: "correspondente",
    responsible: "Cliente",
  },
  escolha_terreno: {
    label: "Escolha do terreno",
    phase: "correspondente",
    responsible: "Cliente",
  },
  escolha_terreno_engenheiro: {
    label: "Escolha do terreno e do engenheiro local",
    phase: "correspondente",
    responsible: "Cliente",
    hint: "Muitas vezes já vêm definidos pelo corretor ou engenheiro parceiro.",
  },
  escolha_engenheiro: {
    label: "Escolha do engenheiro local",
    phase: "correspondente",
    responsible: "Cliente",
  },
  projeto_prefeitura: {
    label: "Projeto de engenharia e aprovação na prefeitura",
    phase: "correspondente",
    responsible: "Engenheiro local",
  },
  documentacao_engenharia: {
    label: "Entrega da documentação de engenharia",
    phase: "correspondente",
    responsible: "Engenheiro local",
  },
  taxa_engenharia: {
    label: "Pagamento da taxa de engenharia",
    phase: "correspondente",
    responsible: "Cliente",
    hint: "Boleto: condição para a Caixa convocar a vistoria.",
  },
  vistoria_engenharia: {
    label: "Vistoria da engenharia Caixa",
    phase: "correspondente",
    responsible: "Engenharia Caixa",
    system: "SIOPI",
    hint: "Reprovação não encerra o processo: dá para ajustar e tentar de novo.",
  },
  avaliacao_garantia: {
    label: "Avaliação do imóvel em garantia",
    phase: "correspondente",
    responsible: "Engenharia Caixa",
    system: "SIOPI",
  },
  ajustes_pept: {
    label: "Ajustes de projeto (PEPT)",
    phase: "correspondente",
    responsible: "Engenheiro local",
    conditional: true,
    returnsTo: "vistoria_engenharia",
    hint: "Só quando a engenharia Caixa pede ajuste no projeto.",
  },
  proposta_siopi: {
    label: "Criação da proposta e dados do contrato",
    phase: "montagem",
    responsible: "Escritório",
    system: "SIOPI",
  },
  envio_conformidade: {
    label: "Envio para conformidade",
    phase: "conformidade_contrato",
    responsible: "Escritório",
    system: "SICTD",
    hint: "Documentos pessoais, do imóvel e formulários assinados.",
  },
  pendencias_conformidade: {
    label: "Correção de pendências da conformidade",
    phase: "conformidade_contrato",
    responsible: "Escritório",
    system: "SICTD",
    conditional: true,
    returnsTo: "envio_conformidade",
    hint: "Só quando a conformidade aponta pendência.",
  },
  revisao_gerente: {
    label: "Revisão final pelo gerente da agência",
    phase: "agencia",
    responsible: "Gerente da agência",
    system: "SIOPI",
  },
  contrato_agendamento: {
    label: "Geração do contrato e agendamento da assinatura",
    phase: "agencia",
    responsible: "Escritório",
    system: "SIOPI",
  },
  assinatura: {
    label: "Assinatura do contrato",
    phase: "agencia",
    responsible: "Cliente (e vendedor, quando houver)",
  },
  itbi: {
    label: "Recolhimento do ITBI e encargos de transferência",
    phase: "cri",
    responsible: "Cliente",
    hint: "Na prefeitura.",
  },
  registro_cartorio: {
    label: "Registro em cartório de imóveis",
    phase: "cri",
    responsible: "Cliente",
  },
  registro_garantia: {
    label: "Registro da garantia em cartório",
    phase: "cri",
    responsible: "Cliente",
    hint: "Alienação fiduciária sobre o imóvel que o cliente já tem.",
  },
  envio_matricula: {
    label: "Envio do contrato e da matrícula atualizada",
    phase: "cri",
    responsible: "Escritório",
    system: "SICTD",
    hint: "Confirma a garantia: última etapa acompanhada aqui.",
  },
} as const satisfies StepCatalog;

type StepKey = keyof typeof STEPS;

const INICIO: StepKey[] = [
  "captacao",
  "simulacao",
  "definicao_simulacao",
  "documentacao_pessoal",
  "analise_risco",
  "evolucao_score",
];

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
  return STEP_TRACKS[trackForModality(modality)].steps.map((key) => ({ key, ...STEPS[key] }));
}

/**
 * Todas as etapas, na ordem do funil. É a ordem das colunas do Kanban quando
 * ele mostra processos de modalidades diferentes juntos.
 */
export const STEP_ORDER: ProcessStepDef[] = Object.entries(STEPS as StepCatalog).map(
  ([key, def]) => ({ key, ...def }),
);

/** Rótulo de qualquer etapa, para o histórico — que guarda só a chave. */
export function stepLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return (STEPS as StepCatalog)[key]?.label ?? key;
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
export function nextStep(
  steps: ProcessStepDef[],
  current: ProcessStepDef,
): ProcessStepDef | null {
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
