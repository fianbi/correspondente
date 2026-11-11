/**
 * Embute a DAMP offline da Caixa (MO29300) no código.
 *
 * A DAMP não é um .dot: é a própria página HTML que a Caixa distribui, com
 * as regras e a impressão dela. O sistema serve essa mesma página, com um
 * script no fim que a preenche a partir do processo (ver src/server/damp).
 * A única mudança no arquivo é o logotipo, que vira data URI para a página
 * funcionar sem o .png ao lado.
 *
 * Uso, quando a Caixa mandar versão nova (trocar MO29300-damp.html):
 *   node scripts/modelos/gerar-caixa-mo29300-damp.mjs
 * Escreve src/server/damp/pagina-mo29300.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
let html = fs.readFileSync(path.join(aqui, "MO29300-damp.html"), "utf8").replace(/^﻿/, "");
const logo = fs.readFileSync(path.join(aqui, "logocaixagrayscale.png")).toString("base64");
if (!html.includes('src="logocaixagrayscale.png"')) throw new Error("Logotipo não encontrado na página.");
html = html.replace('src="logocaixagrayscale.png"', `src="data:image/png;base64,${logo}"`);
if (!html.includes("</html>")) throw new Error("Página sem </html>.");

const destino = path.join(aqui, "../../src/server/damp/pagina-mo29300.ts");
fs.writeFileSync(
  destino,
  "// Gerado por scripts/modelos/gerar-caixa-mo29300-damp.mjs; não editar à mão.\n" +
    `export const DAMP_MO29300_HTML = ${JSON.stringify(html)};\n`,
);
console.log(`Escrito ${path.relative(process.cwd(), destino)} (${html.length} caracteres).`);
