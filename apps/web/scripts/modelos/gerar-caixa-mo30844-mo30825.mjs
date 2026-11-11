/**
 * Gera os fundos dos modelos prontos Caixa MO30844 ("Autorização da forma de
 * pagamento") e MO30825 ("Proposta de Seguro Habitacional") a partir dos .dot
 * que a Caixa distribui.
 *
 * Como no MO43047011, gera só o fundo; os valores são escritos por cima na
 * geração (ver src/server/pdf/modelos/index.ts). Dois acertos no fundo:
 *
 * - MO30844: a tabela Cliente/CPF/Agência/Conta é uma tabela flutuante no
 *   Word. O LibreOffice a desenha ao lado do "(   ) Autorizo ou altero o
 *   débito", jogando o "(" e o ")" para fora da tabela. O .dot passa pelo
 *   formato ODF plano (.fodt), a tabela sai do quadro flutuante e volta a ficar
 *   acima do parágrafo, como no Word.
 * - Assinaturas dos dois: a linha "   /   (1º participante/CPF)" vira o lugar
 *   do nome e do CPF de cada participante, e a legenda desce, em letra menor.
 *
 * Uso (precisa do LibreOffice no PATH):
 *   node scripts/modelos/gerar-caixa-mo30844-mo30825.mjs
 * Escreve src/server/pdf/modelos/caixa-mo30844.ts e caixa-mo30825.ts.
 */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "caixa-mo-"));

function soffice(formato, arquivo) {
  execFileSync("soffice", ["--headless", "--convert-to", formato, "--outdir", tmp, arquivo], {
    stdio: "ignore",
  });
  return path.join(tmp, path.basename(arquivo).replace(/\.[^.]+$/, `.${formato}`));
}

/** .dot → PDF, com um acerto opcional no XML do documento no meio do caminho. */
function converter(dot, acertar) {
  if (!acertar) return fs.readFileSync(soffice("pdf", path.join(aqui, dot)));
  const fodt = soffice("fodt", path.join(aqui, dot));
  fs.writeFileSync(fodt, acertar(fs.readFileSync(fodt, "utf8")));
  return fs.readFileSync(soffice("pdf", fodt));
}

/**
 * Troca a linha "   /   (Nº participante/CPF)" de cada assinatura por um
 * espaço em branco (onde a geração escreve nome e CPF) e redesenha a legenda
 * logo abaixo, em letra menor.
 */
async function assinaturas(doc, pagina, linhas) {
  const page = doc.getPage(pagina);
  const H = page.getHeight();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const { topo, base, legendas } of linhas) {
    page.drawRectangle({ x: 54, y: H - base - 3.5, width: 500, height: base + 3.5 - topo, color: rgb(1, 1, 1) });
    for (const [legenda, x] of legendas) {
      page.drawText(legenda, { x, y: H - base - 21.5, size: 7, font, color: rgb(0, 0, 0) });
    }
  }
}

async function salvar(doc, titulo, constante, arquivo) {
  doc.setTitle(titulo);
  const base64 = Buffer.from(await doc.save()).toString("base64");
  const saida = path.join(aqui, "../../src/server/pdf/modelos", arquivo);
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  fs.writeFileSync(
    saida,
    `// Gerado por scripts/modelos/gerar-caixa-mo30844-mo30825.mjs — não editar à mão.\n` +
      `export const ${constante} =\n  "${base64}";\n`,
  );
  console.log(`fundo → ${saida}`);
}

// MO30844: tabela flutuante de volta ao fluxo do texto.
{
  const pdf = converter("MO30844012.dot", (xml) => {
    const quadro =
      /(<text:p [^>]*>)<draw:frame [^>]*draw:name="Frame2"[^>]*>\s*<draw:text-box[^>]*>(.*?<\/table:table>)\s*<\/draw:text-box>\s*<\/draw:frame>/s;
    if (!quadro.test(xml)) throw new Error("MO30844: tabela do cliente não encontrada no .dot");
    return xml.replace(quadro, (_, paragrafo, tabela) => tabela + paragrafo);
  });
  const doc = await PDFDocument.load(pdf);
  await assinaturas(doc, 1, [
    { topo: 316, base: 326.5, legendas: [["(1º participante/CPF)", 57], ["(2º PARTICIPANTE/CPF)", 304]] },
    { topo: 379.5, base: 390, legendas: [["(3º participante/CPF)", 57], ["(4º participante/CPF)", 304]] },
  ]);
  await salvar(doc, "Autorização da forma de pagamento (MO30844)", "CAIXA_MO30844_PDF_BASE64", "caixa-mo30844.ts");
}

// MO30825: só as assinaturas.
{
  const doc = await PDFDocument.load(converter("MO30825005.dot"));
  await assinaturas(doc, 2, [
    { topo: 188, base: 195, legendas: [["(1º participante/CPF)", 57], ["(2º PARTICIPANTE/CPF)", 304]] },
    { topo: 251.4, base: 258.5, legendas: [["(3º participante/CPF)", 57], ["(4º participante/CPF)", 304]] },
  ]);
  await salvar(doc, "Proposta de Seguro Habitacional (MO30825)", "CAIXA_MO30825_PDF_BASE64", "caixa-mo30825.ts");
}
