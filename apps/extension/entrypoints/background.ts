import { ouvirCapturaAutomatica } from "@/src/envio-auto";

/**
 * Abre o painel lateral quando o ícone é clicado, e leva a captura automática
 * do content script até o sistema.
 *
 * O service worker do MV3 é desligado pelo navegador a qualquer momento, então
 * nada fica em memória aqui: o estado da captura vive no `chrome.storage`.
 */
export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // Navegador sem painel lateral: o clique no ícone simplesmente não abre.
  });

  ouvirCapturaAutomatica();
});
