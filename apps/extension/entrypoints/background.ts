/**
 * Abre o painel lateral quando o ícone é clicado.
 *
 * Toda a lógica vive no painel e no content script: o service worker do MV3 é
 * desligado pelo navegador a qualquer momento, então guardar estado aqui seria
 * perder estado na hora errada.
 */
export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // Navegador sem painel lateral: o clique no ícone simplesmente não abre.
  });
});
