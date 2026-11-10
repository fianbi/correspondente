/**
 * Gera o modelo pronto do formulário Caixa MO43047011 ("Apresentação de
 * Propostas de Negócios, Informações Complementares e Ateste de Verificação
 * Documental") a partir do .dot que a Caixa distribui.
 *
 * Gera só o fundo: o .dot convertido em PDF, com os programas trocados pelos
 * que o escritório usa. Os valores são escritos por cima na geração, na mesma
 * letra do formulário (ver src/server/pdf/modelos/index.ts).
 *
 * Uso (precisa do LibreOffice no PATH):
 *   node scripts/modelos/gerar-caixa-mo43047011.mjs
 * Escreve src/server/pdf/modelos/caixa-mo43047011.ts (PDF em base64, para ir
 * junto no bundle do servidor sem depender de arquivo em disco).
 */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mo43047011-"));
execFileSync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", tmp, path.join(aqui, "MO43047011.dot")], {
  stdio: "ignore",
});
const doc = await PDFDocument.load(fs.readFileSync(path.join(tmp, "MO43047011.pdf")));
doc.setTitle("Apresentação de Propostas de Negócios, Informações Complementares e Ateste de Verificação Documental (MO43047011)");
const page = doc.getPage(0);
const H = page.getHeight();
const font = await doc.embedFont(StandardFonts.Helvetica);
// [nome, x, yTopo, largura, altura, marca?]  (coordenadas do topo, como no pdftotext)
// Programas: o escritório usa MCMV, SBPE, PRO-COTISTA e EGI, não os rótulos
// impressos (PCVA, CCFGTS, CCSBPE, PRO-COTISTA). Cobre os rótulos antigos e
// escreve os novos ao lado dos mesmos quadrinhos.
for (const [x, largura] of [
  [80, 35],
  [154, 53],
  [247, 52],
  [339, 85],
  [314, 23], // quadrinho original do 4º programa: "PRO-COTISTA" precisa do espaço
]) {
  page.drawRectangle({ x, y: H - 398, width: largura, height: 19, color: rgb(1, 1, 1) });
}
// Quadrinho do EGI, depois do rótulo PRO-COTISTA.
page.drawRectangle({
  x: 341,
  y: H - 395,
  width: 16,
  height: 14,
  borderColor: rgb(0, 0, 0),
  borderWidth: 0.75,
});
for (const [rotulo, x] of [
  ["MCMV", 81],
  ["SBPE", 155],
  ["PRO-COTISTA", 248],
  ["EGI", 364],
]) {
  page.drawText(rotulo, { x, y: H - 393, size: 11, font, color: rgb(0, 0, 0) });
}

// Conta corrente: a linha "Agência ___ Operação ___ Conta ___ DV __" é
// reescrita na geração com os valores no meio do texto, então sai do fundo.
page.drawRectangle({ x: 179, y: H - 321.5, width: 358, height: 13.5, color: rgb(1, 1, 1) });

const base64 = Buffer.from(await doc.save()).toString("base64");
const saida = path.join(aqui, "../../src/server/pdf/modelos/caixa-mo43047011.ts");
fs.mkdirSync(path.dirname(saida), { recursive: true });
fs.writeFileSync(
  saida,
  `// Gerado por scripts/modelos/gerar-caixa-mo43047011.mjs — não editar à mão.\n` +
    `export const CAIXA_MO43047011_PDF_BASE64 =\n  "${base64}";\n`,
);
console.log(`fundo → ${saida}`);
