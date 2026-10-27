import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: ".",
  manifest: {
    name: "Correspondente — preenchimento",
    description:
      "Leva os dados do processo para a tela do banco e traz de volta o que estiver lá.",
    permissions: ["storage", "sidePanel", "activeTab", "scripting"],
    // O portal da Caixa e o próprio sistema. Nada além disso: a extensão não
    // tem motivo para enxergar outras abas do navegador.
    host_permissions: [
      "https://*.caixa.gov.br/*",
      "http://localhost:3000/*",
    ],
    action: { default_title: "Correspondente" },
    side_panel: { default_path: "sidepanel.html" },
  },
});
