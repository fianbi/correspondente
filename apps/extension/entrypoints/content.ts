import { captureScreen, discoverFields, fillScreen } from "@corr/portal";
import type { PanelRequest, PanelResponse } from "@/src/messages";

/**
 * Content script: o único pedaço que toca a página do banco.
 *
 * Ele não decide nada — recebe a tela já escolhida pelo painel, aplica, e
 * responde o que aconteceu campo a campo. Nunca submete formulário: quem
 * confere e salva é o operador.
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
  },
});

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
