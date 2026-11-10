/**
 * Gera o modelo pronto do formulário Caixa MO43047011 ("Apresentação de
 * Propostas de Negócios, Informações Complementares e Ateste de Verificação
 * Documental") a partir do .dot que a Caixa distribui.
 *
 * O .dot usa campos de formulário legados do Word, que o LibreOffice não
 * exporta como campos de PDF. Então: converte o .dot em PDF "chapado" e
 * desenha por cima os campos AcroForm, nas posições dos espaços do original,
 * com nomes legíveis (os do Word eram "Texto39 Copy 7").
 *
 * Uso (precisa do LibreOffice no PATH):
 *   node scripts/modelos/gerar-caixa-mo43047011.mjs
 * Escreve src/server/pdf/modelos/caixa-mo43047011.ts (PDF em base64, para ir
 * junto no bundle do servidor sem depender de arquivo em disco).
 */
import { PDFDocument, rgb, StandardFonts, TextAlignment } from "pdf-lib";
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
const form = doc.getForm();
const font = await doc.embedFont(StandardFonts.Helvetica);
// [nome, x, yTopo, largura, altura, marca?]  (coordenadas do topo, como no pdftotext)
const campos = [
  ["Razão Social - CCA", 60, 160, 362, 14],
  ["Código - CCA", 429, 160, 105, 14],
  ["Proponente", 60, 201, 362, 12],
  ["CPF do proponente", 429, 201, 105, 12],
  ["Coobrigado", 60, 239, 362, 13],
  ["CPF do coobrigado", 429, 239, 105, 13],
  ["Dossiê Principal", 58, 264, 16, 14, 1],
  ["Documentação Complementar", 299, 264, 16, 14, 1],
  ["Conta Corrente", 55, 309, 14, 12, 1],
  ["Conta Corrente - Agência", 222, 308, 30, 12],
  ["Conta Corrente - Operação", 303, 308, 31, 12],
  ["Conta Corrente - Conta", 366, 308, 38, 12],
  ["Conta Corrente - DV", 421, 308, 14, 12],
  ["Conta Poupança", 55, 323, 14, 12, 1],
  ["Conta Poupança - Agência", 222, 323, 30, 12],
  ["Conta Poupança - Operação", 303, 323, 31, 12],
  ["Conta Poupança - Conta", 366, 323, 38, 12],
  ["Conta Poupança - DV", 421, 323, 14, 12],
  ["Cheque Especial", 55, 337, 14, 12, 1],
  ["Cartão de Crédito", 180, 337, 22, 12, 1],
  ["Crédito Consignado", 324, 337, 16, 12, 1],
  ["MCMV", 58, 381, 16, 14, 1],
  ["SBPE", 132, 381, 16, 14, 1],
  ["PRO-COTISTA", 224, 381, 16, 14, 1],
  ["EGI", 341, 381, 16, 14, 1],
  ["Nº do Contrato", 136, 407, 398, 13],
  ["Construtora", 120, 432, 142, 13],
  ["Empreendimento", 353, 432, 182, 13],
  ["Renda Formal", 56, 487, 16, 15, 1],
  ["Outras Rendas", 131, 487, 16, 15, 1],
  ["Comprovante de Endereço - Titular", 293, 487, 16, 15, 1],
  ["Comprovante de Endereço - Em Nome de Terceiros", 365, 487, 16, 15, 1],
  ["Declaração - sócios/familiares não participam", 61, 513, 23, 12, 1],
  ["Local", 57, 639, 262, 12],
  ["Dia", 327, 639, 40, 12],
  ["Mês", 383, 639, 97, 12],
  ["Ano", 497, 639, 41, 12],
];
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
  page.drawText(rotulo, { x, y: H - 393, size: 11.5, font, color: rgb(0, 0, 0) });
}

for (const [nome, x, topo, w, h, marca] of campos) {
  const f = form.createTextField(nome);
  if (marca) f.setAlignment(TextAlignment.Center);
  f.addToPage(page, { x, y: H - topo - h, width: w, height: h, font, borderWidth: 0, backgroundColor: undefined, borderColor: undefined });
  f.setFontSize(marca ? 10 : 9);
}
const base64 = Buffer.from(await doc.save()).toString("base64");
const saida = path.join(aqui, "../../src/server/pdf/modelos/caixa-mo43047011.ts");
fs.mkdirSync(path.dirname(saida), { recursive: true });
fs.writeFileSync(
  saida,
  `// Gerado por scripts/modelos/gerar-caixa-mo43047011.mjs — não editar à mão.\n` +
    `export const CAIXA_MO43047011_PDF_BASE64 =\n  "${base64}";\n`,
);
console.log(`${form.getFields().length} campos → ${saida}`);
