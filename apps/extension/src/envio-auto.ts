import { api, lerConfig } from "./api";
import {
  CHAVE_DESLIGADA,
  CHAVE_DIAGNOSTICO,
  chaveDaAba,
  CHAVE_ULTIMA,
  decidirEnvio,
  esquecerEnvio,
  ESTADO_INICIAL,
  saiuDoCadastro,
  TELA_FORMULARIOS_ENVIADOS,
  TELAS_QUE_ABREM_CADASTRO,
  type Diagnostico,
  type EstadoCaptura,
  type UltimaCaptura,
} from "./captura-auto";
import { hasRiskAssessment, type AutoCapture } from "@corr/portal";
import type { CapturaDaPagina, FormulariosDaPagina } from "./messages";

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
  mensagem: CapturaDaPagina & { captura: AutoCapture },
  tabId: number,
  frameId: number,
): Promise<string> {
  const config = await lerConfig();
  if (!config) return "sem endereço do sistema";
  if ((await chrome.storage.local.get(CHAVE_DESLIGADA))[CHAVE_DESLIGADA]) {
    return "captura automática desligada";
  }

  const agora = Date.now();
  const estado = await lerEstado(tabId);
  // Quem mostrou o CPF: só o documento de cima da aba tem a URL que diz se o
  // operador saiu do cadastro (ver `ouvirCapturaAutomatica`).
  const origem = mensagem.captura.cpf ? { cpfNoTopo: frameId === 0 } : {};

  const abreCadastro = TELAS_QUE_ABREM_CADASTRO.has(mensagem.captura.screenKey ?? "");
  if (mensagem.momento === "carregou" && !abreCadastro) {
    // Abrir a tela não envia nada (fora as que abrem o cadastro): só registra
    // de quem é o cadastro em curso.
    if (mensagem.captura.cpf) {
      await gravarEstado(tabId, { ...estado, ...origem, cpf: mensagem.captura.cpf, cpfEm: agora });
      return "CPF guardado para as próximas telas";
    }
    return "tela aberta; envia ao salvar ou sair";
  }

  const decisao = decidirEnvio(
    estado,
    mensagem.momento === "carregou" ? semMarcacoes(mensagem.captura) : mensagem.captura,
    agora,
  );
  await gravarEstado(tabId, { ...decisao.estado, ...origem });
  const envio = decisao.envio;
  if (!envio) {
    if (!decisao.estado.cpf) return "sem CPF: passe pela tela \"CPF do Cliente\" ou de dados cadastrais";
    if (mensagem.captura.screenKey === null) return "CPF guardado para as próximas telas";
    const vazia =
      Object.keys(mensagem.captura.values).length === 0 && mensagem.captura.incomes.length === 0;
    return vazia ? "tela sem dados preenchidos" : "mesmo conteúdo já enviado";
  }

  const base = { em: agora, screenKey: envio.screenKey, cpfFinal: envio.cpf.slice(-4) };
  try {
    const { chave: _chave, ...corpo } = envio;
    const resposta = await api.capturarPorCpf(config, corpo);
    const { found, applied, incomesAdded } = resposta;
    await registrar({
      ...base,
      applied,
      incomesAdded: incomesAdded ?? 0,
      created: resposta.created === true,
      spouseCreated: resposta.spouseCreated === true,
      ignored: resposta.ignored ?? [],
      // Sem nome na tela não há como criar: a tela de dados cadastrais cria.
      erro: found
        ? null
        : "CPF ainda sem cadastro; ele é criado quando a tela de dados cadastrais tiver o nome.",
    });
    return found ? "enviado" : "enviado; CPF sem cadastro";
  } catch (falha) {
    // Rede ou servidor: o mesmo conteúdo pode ir na próxima leitura.
    await gravarEstado(tabId, esquecerEnvio(await lerEstado(tabId), envio.chave));
    await registrar({
      ...base,
      applied: [],
      erro: falha instanceof Error ? falha.message : "Falha ao enviar.",
    });
    return `falha: ${falha instanceof Error ? falha.message : "erro desconhecido"}`;
  }
}

/**
 * Ao abrir a tela, as marcações da declaração de propósitos ainda são as que
 * o portal traz por padrão, não a resposta do cliente. Como a captura não
 * sobrescreve, gravar o padrão agora travaria a resposta de verdade: elas
 * só vão quando o operador envia a tela ou sai dela.
 */
function semMarcacoes(captura: AutoCapture): AutoCapture {
  const values = Object.fromEntries(
    Object.entries(captura.values).filter(([chave]) => !chave.startsWith("person.purpose")),
  );
  return { ...captura, values };
}

/**
 * Formulários enviados: grava no cadastro do CPF consultado as linhas que têm
 * avaliação de risco. O sistema vincula a vigente ao processo aberto que
 * ainda não tem nenhuma.
 *
 * Recarregar a página manda a mesma lista de novo, e tudo bem: o sistema
 * atualiza pela proposta, sem duplicar.
 */
async function processarFormularios(mensagem: FormulariosDaPagina): Promise<string> {
  const config = await lerConfig();
  if (!config) return "sem endereço do sistema";
  if ((await chrome.storage.local.get(CHAVE_DESLIGADA))[CHAVE_DESLIGADA]) {
    return "captura automática desligada";
  }

  const { cpf } = mensagem.leitura;
  if (!cpf) return "lista sem CPF";
  const rows = mensagem.leitura.rows.filter(hasRiskAssessment);
  if (rows.length === 0) return "nenhuma avaliação de risco na lista";

  const base = { em: Date.now(), screenKey: TELA_FORMULARIOS_ENVIADOS, cpfFinal: cpf.slice(-4), applied: [] };
  try {
    const resposta = await api.avaliacoesDeRisco(config, { cpf, rows });
    await registrar({
      ...base,
      riskAssessments: {
        added: resposta.added,
        updated: resposta.updated,
        linkedProcesses: resposta.linkedProcesses,
      },
      erro: resposta.found
        ? null
        : "CPF ainda sem cadastro; passe pelo cadastro de clientes e consulte de novo.",
    });
    return resposta.found
      ? `${rows.length} avaliação(ões) de risco enviada(s)`
      : "enviado; CPF sem cadastro";
  } catch (falha) {
    const motivo = falha instanceof Error ? falha.message : "Falha ao enviar.";
    await registrar({ ...base, erro: motivo });
    return `falha: ${motivo}`;
  }
}

/**
 * Cada leitura que chega, com o que se fez dela. É o que permite entender, no
 * uso real, por que uma tela não foi para o sistema sem abrir o DevTools.
 */
async function anotar(
  mensagem: CapturaDaPagina | FormulariosDaPagina,
  resultado: string,
): Promise<void> {
  const item: Diagnostico =
    mensagem.kind === "formularios-enviados"
      ? {
          em: Date.now(),
          momento: "carregou",
          url: mensagem.url ?? null,
          screenKey: TELA_FORMULARIOS_ENVIADOS,
          cpfFinal: mensagem.leitura.cpf?.slice(-4) ?? null,
          campos: mensagem.leitura.rows.length,
          resultado,
        }
      : {
          em: Date.now(),
          momento: mensagem.momento,
          url: mensagem.url ?? null,
          screenKey: mensagem.captura?.screenKey ?? null,
          cpfFinal: mensagem.captura?.cpf?.slice(-4) ?? null,
          campos: mensagem.captura ? Object.keys(mensagem.captura.values).length : 0,
          resultado,
        };
  const anteriores =
    ((await chrome.storage.local.get(CHAVE_DIAGNOSTICO))[CHAVE_DIAGNOSTICO] as
      | Diagnostico[]
      | undefined) ?? [];
  await chrome.storage.local.set({ [CHAVE_DIAGNOSTICO]: [item, ...anteriores].slice(0, 15) });
}

// O envio do formulário e a saída da página chegam quase juntos. Em fila, o
// segundo já encontra o primeiro marcado como enviado.
let fila: Promise<void> = Promise.resolve();

export function ouvirCapturaAutomatica(): void {
  chrome.runtime.onMessage.addListener((mensagem: unknown, remetente, responder) => {
    const tabId = remetente.tab?.id;
    if (tabId === undefined) return false;

    const formularios = mensagem as Partial<FormulariosDaPagina> | null;
    if (formularios?.kind === "formularios-enviados" && formularios.leitura) {
      const lida = formularios as FormulariosDaPagina;
      fila = fila
        .then(async () => anotar(lida, await processarFormularios(lida)))
        .catch(() => undefined)
        .finally(() => responder({ ok: true }));
      return true;
    }

    const recebida = mensagem as Partial<CapturaDaPagina> | null;
    if (recebida?.kind !== "captura-auto") return false;

    fila = fila
      .then(async () => {
        const lida = recebida as CapturaDaPagina;
        const resultado = lida.captura
          ? await processar(lida as CapturaDaPagina & { captura: AutoCapture }, tabId, remetente.frameId ?? 0)
          : "tela não reconhecida pelo perfil";
        await anotar(lida, resultado);
      })
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
