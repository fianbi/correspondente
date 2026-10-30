import type { AutoCapture, SavedIncome } from "@corr/portal";

/**
 * Regras da captura automática, separadas do Chrome para serem testáveis.
 *
 * O content script lê a tela ao abrir (só a de dados cadastrais), no envio do
 * formulário e na saída da página, e manda o que leu para o background. Aqui
 * se decide se aquilo vira um envio para o sistema: a pessoa vem do CPF da
 * própria tela ou, nas telas que não o mostram, do último CPF visto na mesma
 * sessão de cadastro.
 *
 * O portal é a fonte: o que muda lá atualiza o cadastro. E só o que muda vai
 * para a API. A extensão guarda, por CPF, o último valor que o sistema
 * recebeu de cada campo (e de cada lista de rendas) e manda só a diferença;
 * tela aberta e salva sem alteração não gera chamada nenhuma.
 */

export interface EstadoCaptura {
  /** Último CPF visto numa tela do portal. */
  cpf: string | null;
  /** Quando o CPF foi visto ou usado pela última vez (ms). */
  cpfEm: number;
  /**
   * Por CPF, o último valor que o sistema recebeu de cada campo. As listas
   * de renda entram como `rendas:<tela>`, serializadas.
   */
  conhecidos: Record<string, Record<string, string>>;
  /**
   * O CPF veio do documento de cima da aba. Só nesse caso a URL da aba diz
   * onde o operador está; com o cadastro dentro de um frame, ela não muda.
   */
  cpfNoTopo?: boolean;
}

export interface Envio {
  cpf: string;
  screenKey: string;
  /** Só os campos que mudaram desde o último envio deste CPF. */
  values: Record<string, string>;
  /** A lista inteira da tela, quando ela mudou; vazia quando não. */
  incomes: SavedIncome[];
  /** O que se sabia antes deste envio, para desfazer se ele falhar. */
  anterior: Record<string, string>;
}

export const ESTADO_INICIAL: EstadoCaptura = { cpf: null, cpfEm: 0, conhecidos: {} };

/**
 * Sem atividade por esse tempo, o CPF guardado deixa de valer. É a última
 * linha de defesa quando a URL da aba não mostra a saída do cadastro (tela
 * dentro de frame): uma tela de endereço aberta horas depois, já de outro
 * cliente, não vai para o cadastro de quem foi atendido antes.
 */
export const VALIDADE_DO_CPF_MS = 60 * 60 * 1000;

/** CPFs lembrados por aba; os mais antigos saem primeiro. */
const LIMITE_DE_CPFS = 20;

/** Lista de rendas em texto estável: a ordem das chaves não muda o conteúdo. */
function rendasEmTexto(rendas: SavedIncome[]): string {
  return JSON.stringify(
    rendas.map((renda) => Object.entries(renda).sort(([a], [b]) => a.localeCompare(b))),
  );
}

function lembrar(
  conhecidos: EstadoCaptura["conhecidos"],
  cpf: string,
  valores: Record<string, string>,
): EstadoCaptura["conhecidos"] {
  const { [cpf]: _atual, ...outros } = conhecidos;
  const mantidos = Object.entries(outros).slice(-(LIMITE_DE_CPFS - 1));
  return { ...Object.fromEntries(mantidos), [cpf]: valores };
}

export function decidirEnvio(
  estado: EstadoCaptura,
  captura: AutoCapture,
  agora: number,
): { estado: EstadoCaptura; envio: Envio | null } {
  const guardado = estado.cpf && agora - estado.cpfEm <= VALIDADE_DO_CPF_MS ? estado.cpf : null;
  const cpf = captura.cpf ?? guardado;

  if (!cpf) return { estado: { ...estado, cpf: null }, envio: null };

  const visto = { ...estado, cpf, cpfEm: agora };
  if (!captura.screenKey) return { estado: visto, envio: null };

  const anterior = estado.conhecidos[cpf] ?? {};
  const mudados = Object.fromEntries(
    Object.entries(captura.values).filter(([chave, valor]) => anterior[chave] !== valor),
  );

  // Lista vazia numa tela de renda é só "nada cadastrado ainda": não apaga
  // nada no sistema, então nem vale a chamada.
  const chaveDasRendas = `rendas:${captura.screenKey}`;
  const rendas = captura.incomes.length > 0 ? rendasEmTexto(captura.incomes) : null;
  const rendasMudaram = rendas !== null && anterior[chaveDasRendas] !== rendas;

  if (Object.keys(mudados).length === 0 && !rendasMudaram) return { estado: visto, envio: null };

  const atualizado = { ...anterior, ...mudados, ...(rendasMudaram ? { [chaveDasRendas]: rendas! } : {}) };
  return {
    estado: { ...visto, conhecidos: lembrar(estado.conhecidos, cpf, atualizado) },
    envio: {
      cpf,
      screenKey: captura.screenKey,
      values: mudados,
      incomes: rendasMudaram ? captura.incomes : [],
      anterior,
    },
  };
}

/**
 * O envio não chegou ao cadastro (rede, servidor, ou CPF ainda sem pessoa):
 * volta ao que se sabia antes, para a próxima leitura mandar de novo.
 */
export function esquecerEnvio(estado: EstadoCaptura, envio: Envio): EstadoCaptura {
  return { ...estado, conhecidos: lembrar(estado.conhecidos, envio.cpf, envio.anterior) };
}

/** Estado da sessão de cadastro (`chrome.storage.session`: some ao fechar o navegador). */
export const CHAVE_ESTADO = "corr.capturaAuto.estado";
/** Chave do estado de uma aba: cada aba tem o seu cadastro em curso. */
export const chaveDaAba = (tabId: number) => `${CHAVE_ESTADO}.${tabId}`;

/**
 * Telas que abrem o cadastro: com elas, a leitura já vale ao abrir a tela, e
 * não só ao sair. É o que cria a pessoa que o escritório ainda não tem.
 */
export const TELAS_QUE_ABREM_CADASTRO = new Set(["cadastro_dados"]);
/** Resultado do último envio, que o painel mostra. */
export const CHAVE_ULTIMA = "corr.capturaAuto.ultima";
/** Presente quando o operador desligou a captura automática no painel. */
export const CHAVE_DESLIGADA = "corr.capturaAuto.desligada";
/** Perfil do portal carregado pelo painel, para o content script reconhecer a tela. */
export const CHAVE_PERFIL = "corr.perfil";

export interface UltimaCaptura {
  em: number;
  screenKey: string;
  /** Só o fim do CPF: o painel identifica a pessoa sem expor o número. */
  cpfFinal: string;
  applied: string[];
  /** Rendas da lista do portal que entraram no cadastro. */
  incomesAdded?: number;
  /** Rendas que já existiam e foram atualizadas pelo portal. */
  incomesUpdated?: number;
  /** A pessoa não existia e foi criada com esta tela. */
  created?: boolean;
  /** O cônjuge da tela também ganhou cadastro. */
  spouseCreated?: boolean;
  /** Campos que a tela mostrou num formato que o cadastro não aceita. */
  ignored?: string[];
  /** Tela de formulários enviados: avaliações de risco gravadas e processos que as receberam. */
  riskAssessments?: { added: number; updated: number; linkedProcesses: number[] };
  erro: string | null;
}

/** `screenKey` da tela de formulários enviados, que não é tela de cadastro do perfil. */
export const TELA_FORMULARIOS_ENVIADOS = "formularios_enviados";

/** Pedaço da URL comum a todas as telas do cadastro de clientes do portal. */
const FLUXO_DE_CADASTRO = "cadastro_cliente";

/**
 * A aba navegou para fora do cadastro de clientes, e o CPF guardado não vale
 * mais. Só decide quando o CPF veio do documento de cima: com o cadastro em
 * frame, a URL da aba não acompanha as telas.
 */
export function saiuDoCadastro(estado: EstadoCaptura, url: string): boolean {
  return estado.cpfNoTopo === true && !url.includes(FLUXO_DE_CADASTRO);
}

/** Últimas leituras e o que se fez delas, para o painel mostrar. */
export const CHAVE_DIAGNOSTICO = "corr.capturaAuto.diagnostico";

export interface Diagnostico {
  em: number;
  momento: "carregou" | "enviou" | "saiu";
  url: string | null;
  screenKey: string | null;
  cpfFinal: string | null;
  campos: number;
  resultado: string;
}
