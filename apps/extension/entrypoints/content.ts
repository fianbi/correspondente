import { captureScreen, discoverFields, fillScreen, matchScreen } from "@corr/portal";
import type { PanelRequest, PanelResponse } from "@/src/messages";

/**
 * Content script: o único pedaço que toca a página do banco.
 *
 * Ele não decide nada — recebe o perfil e os valores do painel, aplica, e
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
  const url = location.href;

  switch (mensagem.kind) {
    case "reconhecer": {
      const tela = matchScreen(mensagem.profile.screens, url, document);
      return {
        kind: "reconhecido",
        screenKey: tela?.key ?? null,
        screenLabel: tela?.label ?? null,
        url,
      };
    }

    case "preencher": {
      const tela = matchScreen(mensagem.profile.screens, url, document);
      if (!tela) return { kind: "erro", message: "Esta tela do portal não está mapeada." };

      return {
        kind: "preenchido",
        outcomes: fillScreen(document, tela, mensagem.values, {
          skipFilled: mensagem.skipFilled,
        }),
      };
    }

    case "capturar": {
      const tela = matchScreen(mensagem.profile.screens, url, document);
      if (!tela) return { kind: "erro", message: "Esta tela do portal não está mapeada." };
      return { kind: "capturado", values: captureScreen(document, tela) };
    }

    case "descobrir": {
      const tela = matchScreen(mensagem.profile.screens, url, document);
      return {
        kind: "descoberto",
        fields: discoverFields(document, tela),
        screenKey: tela?.key ?? null,
      };
    }

    case "destacar": {
      const alvo = document.querySelector<HTMLElement>(mensagem.selector);
      if (!alvo) return { kind: "erro", message: "Campo não encontrado nesta tela." };

      // Destaque temporário: ajuda o operador a confirmar que o mapeamento
      // aponta para o campo certo antes de ensinar.
      const anterior = alvo.style.outline;
      alvo.style.outline = "3px solid #2b62a8";
      alvo.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(() => {
        alvo.style.outline = anterior;
      }, 2000);

      return { kind: "ok" };
    }
  }
}
