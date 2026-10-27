import { api, lerConfig } from "./api";
import {
  CHAVE_DESLIGADA,
  CHAVE_ESTADO,
  CHAVE_ULTIMA,
  decidirEnvio,
  esquecerEnvio,
  ESTADO_INICIAL,
  saiuDoCadastro,
  type EstadoCaptura,
  type UltimaCaptura,
} from "./captura-auto";
import type { CapturaDaPagina } from "./messages";

/**
 * Lado do background da captura automática: recebe o que o content script
 * leu e manda para o sistema.
 *
 * Mora no background porque a página está sendo descarregada quando a leitura
 * chega — o content script não vive o bastante para esperar a resposta da
 * API, e não deve conhecer a API de qualquer forma.
 *
 * O CPF da sessão de cadastro é guardado por aba: duas abas com clientes
 * diferentes não podem trocar dados entre si.
 */

const chaveDaAba = (tabId: number) => `${CHAVE_ESTADO}.${tabId}`;

async function lerEstado(tabId: number): Promise<EstadoCaptura> {
  const chave = chaveDaAba(tabId);
  const guardado = await chrome.storage.session.get(chave);
  return (guardado[chave] as EstadoCaptura | undefined) ?? ESTADO_INICIAL;
}

async function gravarEstado(tabId: number, estado: EstadoCaptura): Promise<void> {
  await chrome.storage.session.set({ [chaveDaAba(tabId)]: estado });
}

async function esquecerAba(tabId: number): Promise<void> {
  await chrome.storage.session.remove(chaveDaAba(tabId));
}

async function registrar(ultima: UltimaCaptura): Promise<void> {
  await chrome.storage.local.set({ [CHAVE_ULTIMA]: ultima });
}

async function processar(
  mensagem: CapturaDaPagina,
  tabId: number,
  frameId: number,
): Promise<void> {
  const config = await lerConfig();
  if (!config) return;
  if ((await chrome.storage.local.get(CHAVE_DESLIGADA))[CHAVE_DESLIGADA]) return;

  const agora = Date.now();
  const estado = await lerEstado(tabId);
  // Quem mostrou o CPF: só o documento de cima da aba tem a URL que diz se o
  // operador saiu do cadastro (ver `ouvirCapturaAutomatica`).
  const origem = mensagem.captura.cpf ? { cpfNoTopo: frameId === 0 } : {};

  if (mensagem.momento === "carregou") {
    // Abrir a tela não envia nada: só registra de quem é o cadastro em curso.
    if (mensagem.captura.cpf) {
      await gravarEstado(tabId, { ...estado, ...origem, cpf: mensagem.captura.cpf, cpfEm: agora });
    }
    return;
  }

  const decisao = decidirEnvio(estado, mensagem.captura, agora);
  await gravarEstado(tabId, { ...decisao.estado, ...origem });
  const envio = decisao.envio;
  if (!envio) return;

  const base = { em: agora, screenKey: envio.screenKey, cpfFinal: envio.cpf.slice(-4) };
  try {
    const { chave: _chave, ...corpo } = envio;
    const { found, applied, incomesAdded } = await api.capturarPorCpf(config, corpo);
    await registrar({
      ...base,
      applied,
      incomesAdded: incomesAdded ?? 0,
      // A extensão não cria pessoa: cadastro novo nasce no sistema, conferido.
      erro: found ? null : "CPF sem cadastro neste escritório; nada foi gravado.",
    });
  } catch (falha) {
    // Rede ou servidor: o mesmo conteúdo pode ir na próxima leitura.
    await gravarEstado(tabId, esquecerEnvio(await lerEstado(tabId), envio.chave));
    await registrar({
      ...base,
      applied: [],
      erro: falha instanceof Error ? falha.message : "Falha ao enviar.",
    });
  }
}

// O envio do formulário e a saída da página chegam quase juntos. Em fila, o
// segundo já encontra o primeiro marcado como enviado.
let fila: Promise<void> = Promise.resolve();

export function ouvirCapturaAutomatica(): void {
  chrome.runtime.onMessage.addListener((mensagem: unknown, remetente, responder) => {
    const recebida = mensagem as Partial<CapturaDaPagina> | null;
    const tabId = remetente.tab?.id;
    if (recebida?.kind !== "captura-auto" || tabId === undefined) return false;

    fila = fila
      .then(() => processar(recebida as CapturaDaPagina, tabId, remetente.frameId ?? 0))
      .catch(() => undefined)
      .finally(() => responder({ ok: true }));
    // Resposta assíncrona: mantém o service worker vivo até o envio terminar.
    return true;
  });

  // A aba saiu do cadastro de clientes: a próxima tela, mesmo de cadastro, só
  // vale depois de um CPF novo. Sem isso, abrir direto o endereço de outro
  // cliente iria para o cadastro do anterior.
  chrome.tabs.onUpdated.addListener((tabId, mudanca) => {
    if (!mudanca.url) return;
    const url = mudanca.url;
    fila = fila
      .then(async () => {
        if (saiuDoCadastro(await lerEstado(tabId), url)) await esquecerAba(tabId);
      })
      .catch(() => undefined);
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    fila = fila.then(() => esquecerAba(tabId)).catch(() => undefined);
  });
}
