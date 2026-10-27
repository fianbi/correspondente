import {
  autoCaptureKey,
  CAIXA_PROFILE,
  captureScreen,
  discoverFields,
  fillScreen,
  readForAutoCapture,
  type PortalProfile,
} from "@corr/portal";
import { CHAVE_PERFIL } from "@/src/captura-auto";
import type { CapturaDaPagina, PanelRequest, PanelResponse } from "@/src/messages";

/**
 * Content script: o único pedaço que toca a página do banco.
 *
 * Ele não decide nada — recebe a tela já escolhida pelo painel, aplica, e
 * responde o que aconteceu campo a campo. Nunca submete formulário: quem
 * confere e salva é o operador.
 *
 * Além disso, faz a captura automática: lê a tela quando o operador envia o
 * formulário ou sai da página, e passa o que leu para o background.
 */
export default defineContentScript({
  matches: ["https://*.caixa.gov.br/*"],
  allFrames: true,
  main() {
    chrome.runtime.onMessage.addListener(
      (mensagem: PanelRequest, _remetente, responder: (r: PanelResponse) => void) => {
        try {
          responder(atender(mensagem));
        } catch (erro) {
          responder({
            kind: "erro",
            message: erro instanceof Error ? erro.message : "Falha inesperada na página.",
          });
        }
        return false;
      },
    );

    observarCapturaAutomatica();
  },
});

/**
 * Captura automática: só escuta eventos e lê campos. Nada é escrito na página
 * nem impedido — o envio do portal segue exatamente como seria sem a extensão.
 */
function observarCapturaAutomatica() {
  // O perfil do escritório (com os campos ensinados) é o que o painel
  // carregou por último; antes de ele chegar do storage, vale o de fábrica.
  // Os ouvintes entram já, sem esperar: um operador rápido pode digitar o CPF
  // e sair da tela antes de a leitura do storage terminar.
  let profile: PortalProfile = CAIXA_PROFILE;
  void chrome.storage.local
    .get(CHAVE_PERFIL)
    .then((guardado) => {
      const perfil = guardado[CHAVE_PERFIL] as PortalProfile | undefined;
      if (perfil) profile = perfil;
    })
    .catch(() => undefined);

  let ultimaChave: string | null = null;

  const avisar = (momento: CapturaDaPagina["momento"]) => {
    const captura = readForAutoCapture(document, profile);
    if (!captura) return;

    // O submit e a saída da página leem o mesmo conteúdo; um aviso basta. O
    // background confere de novo, entre páginas e frames.
    const chave = autoCaptureKey(
      captura.cpf ?? "",
      captura.screenKey,
      captura.values,
      captura.incomes,
    );
    if (momento !== "carregou" && chave === ultimaChave) return;
    if (momento !== "carregou") ultimaChave = chave;

    const mensagem: CapturaDaPagina = { kind: "captura-auto", momento, captura };
    try {
      chrome.runtime.sendMessage(mensagem).catch(() => undefined);
    } catch {
      // Extensão recarregada com a aba aberta: este script ficou órfão e o
      // Chrome recusa a chamada na hora ("Extension context invalidated"). A
      // página segue sem ele; a aba recarregada já vem com o script novo.
    }
  };

  avisar("carregou");
  // Fase de captura: o portal às vezes cancela o evento no próprio handler, e
  // a leitura precisa acontecer antes disso.
  document.addEventListener("submit", () => avisar("enviou"), true);
  // `pagehide` cobre o que o submit não vê: `form.submit()` chamado por
  // script, links e troca de tela dentro de frame.
  window.addEventListener("pagehide", () => avisar("saiu"));
}

function atender(mensagem: PanelRequest): PanelResponse {
  if (mensagem.kind === "destacar") {
    const alvo = document.querySelector<HTMLElement>(mensagem.selector);
    if (!alvo) return { kind: "erro", message: "Campo não encontrado nesta tela." };

    // Destaque temporário: o operador confirma que o mapeamento aponta para o
    // campo certo antes de ensinar.
    const anterior = alvo.style.outline;
    alvo.style.outline = "3px solid #2b62a8";
    alvo.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => {
      alvo.style.outline = anterior;
    }, 2000);

    return { kind: "ok" };
  }

  const tela = mensagem.profile.screens.find((screen) => screen.key === mensagem.screenKey);

  if (mensagem.kind === "descobrir") {
    return { kind: "descoberto", fields: discoverFields(document, tela ?? null) };
  }

  if (!tela) return { kind: "erro", message: "Tela não encontrada no perfil." };

  if (mensagem.kind === "preencher") {
    return {
      kind: "preenchido",
      outcomes: fillScreen(document, tela, mensagem.values, {
        skipFilled: mensagem.skipFilled,
      }),
    };
  }

  return { kind: "capturado", values: captureScreen(document, tela) };
}
