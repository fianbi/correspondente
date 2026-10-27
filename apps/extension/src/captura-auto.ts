import { autoCaptureKey, type AutoCapture, type SavedIncome } from "@corr/portal";

/**
 * Regras da captura automática, separadas do Chrome para serem testáveis.
 *
 * O content script lê a tela no envio do formulário ou na saída da página e
 * manda o que leu para o background. Aqui se decide se aquilo vira um envio
 * para o sistema: a pessoa vem do CPF da própria tela ou, nas telas que não o
 * mostram, do último CPF visto na mesma sessão de cadastro; e o mesmo conteúdo
 * não é mandado duas vezes (o envio do formulário e a saída da página chegam
 * juntos quase sempre).
 */

export interface EstadoCaptura {
  /** Último CPF visto numa tela do portal. */
  cpf: string | null;
  /** Quando o CPF foi visto ou usado pela última vez (ms). */
  cpfEm: number;
  /** Chaves dos envios já feitos, mais recentes no fim. */
  enviados: string[];
  /**
   * O CPF veio do documento de cima da aba. Só nesse caso a URL da aba diz
   * onde o operador está; com o cadastro dentro de um frame, ela não muda.
   */
  cpfNoTopo?: boolean;
}

export interface Envio {
  cpf: string;
  screenKey: string;
  values: Record<string, string>;
  incomes: SavedIncome[];
  chave: string;
}

export const ESTADO_INICIAL: EstadoCaptura = { cpf: null, cpfEm: 0, enviados: [] };

/**
 * Sem atividade por esse tempo, o CPF guardado deixa de valer. É a última
 * linha de defesa quando a URL da aba não mostra a saída do cadastro (tela
 * dentro de frame): uma tela de endereço aberta horas depois, já de outro
 * cliente, não vai para o cadastro de quem foi atendido antes.
 */
export const VALIDADE_DO_CPF_MS = 60 * 60 * 1000;

const LIMITE_DE_ENVIADOS = 100;

export function decidirEnvio(
  estado: EstadoCaptura,
  captura: AutoCapture,
  agora: number,
): { estado: EstadoCaptura; envio: Envio | null } {
  const guardado = estado.cpf && agora - estado.cpfEm <= VALIDADE_DO_CPF_MS ? estado.cpf : null;
  const cpf = captura.cpf ?? guardado;

  if (!cpf) return { estado: { ...estado, cpf: null }, envio: null };

  const visto = { ...estado, cpf, cpfEm: agora };
  const vazia = Object.keys(captura.values).length === 0 && captura.incomes.length === 0;
  if (!captura.screenKey || vazia) {
    return { estado: visto, envio: null };
  }

  const chave = autoCaptureKey(cpf, captura.screenKey, captura.values, captura.incomes);
  if (estado.enviados.includes(chave)) return { estado: visto, envio: null };

  return {
    estado: { ...visto, enviados: [...visto.enviados, chave].slice(-LIMITE_DE_ENVIADOS) },
    envio: {
      cpf,
      screenKey: captura.screenKey,
      values: captura.values,
      incomes: captura.incomes,
      chave,
    },
  };
}

/** Um envio que falhou por rede ou servidor pode ser tentado de novo. */
export function esquecerEnvio(estado: EstadoCaptura, chave: string): EstadoCaptura {
  return { ...estado, enviados: estado.enviados.filter((item) => item !== chave) };
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
  /** A pessoa não existia e foi criada com esta tela. */
  created?: boolean;
  /** O cônjuge da tela também ganhou cadastro. */
  spouseCreated?: boolean;
  erro: string | null;
}

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
