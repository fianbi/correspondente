import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

/**
 * Gera um PDF com campos preenchíveis, para exercitar o caminho real de
 * modelo de formulário sem depender de um arquivo do banco no repositório.
 */
async function pdfComCampos(campos: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const form = doc.getForm();

  campos.forEach((nome, indice) => {
    const y = 760 - indice * 40;
    page.drawText(nome, { x: 40, y: y + 18, size: 9, font });
    const campo = form.createTextField(nome);
    campo.addToPage(page, { x: 40, y, width: 300, height: 16 });
  });

  return Buffer.from(await doc.save());
}

async function primeiroProcesso(page: Page): Promise<string> {
  await page.goto("/processos?view=tabela");
  await page.getByRole("link", { name: /.+/ }).filter({ hasText: /[A-Z]{3}/ }).first().click();
  await page.waitForURL(/\/processos\/[0-9a-f-]{36}/);
  return page.url().split("?")[0]!;
}

test("resumo do processo sai em PDF", async ({ page, request }) => {
  const url = await primeiroProcesso(page);

  const resposta = await request.get(`${url}/resumo.pdf`);
  expect(resposta.status()).toBe(200);
  expect(resposta.headers()["content-type"]).toContain("application/pdf");

  const corpo = await resposta.body();
  expect(corpo.subarray(0, 5).toString()).toBe("%PDF-");

  // O conteúdo precisa ser legível de verdade, não só um arquivo válido.
  const doc = await PDFDocument.load(corpo);
  expect(doc.getPageCount()).toBeGreaterThan(0);
  expect(doc.getTitle()).toMatch(/Processo \d+/);
});

test("resumo não é servido em cache", async ({ page, request }) => {
  const url = await primeiroProcesso(page);
  const resposta = await request.get(`${url}/resumo.pdf`);
  // Um resumo em cache entregaria uma foto velha do processo.
  expect(resposta.headers()["cache-control"]).toContain("no-store");
});

test("modelo sem campos preenchíveis é recusado com explicação", async ({ page }) => {
  await page.goto("/configuracoes/formularios");

  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  const semCampos = Buffer.from(await doc.save());

  await page.getByLabel("Nome").fill("Modelo sem campos");
  await page.getByLabel("Arquivo PDF").setInputFiles({
    name: "sem-campos.pdf",
    mimeType: "application/pdf",
    buffer: semCampos,
  });
  await page.getByRole("button", { name: "Enviar modelo" }).click();

  await expect(page.locator(String.raw`p[role="alert"]`)).toContainText("não tem campos de formulário");
});

test("modelo mapeado gera formulário preenchido com os dados do processo", async ({
  page,
  request,
}) => {
  const nomeDoModelo = `Ficha ${randomUUID().slice(0, 6)}`;

  await page.goto("/configuracoes/formularios");
  await page.getByLabel("Nome").fill(nomeDoModelo);
  await page.getByLabel("Arquivo PDF").setInputFiles({
    name: "ficha.pdf",
    mimeType: "application/pdf",
    buffer: await pdfComCampos(["nome_cliente", "cpf_cliente", "nome_escritorio"]),
  });
  await page.getByRole("button", { name: "Enviar modelo" }).click();
  await expect(page.locator(String.raw`p[role="status"]`)).toContainText("3 campo(s) detectado(s)");

  const cartao = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: nomeDoModelo }) });

  await cartao.getByRole("button", { name: "Mapear campos" }).click();
  await cartao.getByLabel("Dado para o campo nome_cliente").selectOption("person.fullName");
  await cartao.getByLabel("Dado para o campo cpf_cliente").selectOption("person.cpf");
  await cartao.getByLabel("Dado para o campo nome_escritorio").selectOption("org.name");
  await cartao.getByRole("button", { name: "Salvar mapeamento" }).click();
  await expect(cartao.locator(String.raw`p[role="status"]`)).toContainText("3 campo(s) mapeado(s)");

  // Do lado do processo, o modelo aparece pronto para gerar.
  const url = await primeiroProcesso(page);
  await page.getByRole("group").filter({ hasText: "Documentos" }).click();
  const link = page.getByRole("link", { name: nomeDoModelo });
  await expect(link).toBeVisible();

  const href = await link.getAttribute("href");
  const resposta = await request.get(href!);
  expect(resposta.status()).toBe(200);

  const gerado = await PDFDocument.load(await resposta.body());
  const form = gerado.getForm();

  // Os valores chegaram nos campos certos, já formatados como no papel.
  expect(form.getTextField("nome_cliente").getText()).toBeTruthy();
  expect(form.getTextField("cpf_cliente").getText()).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
  expect(form.getTextField("nome_escritorio").getText()).toBe("Escritório Demo");
});

test("painel mostra a distribuição por etapa, banco e modalidade", async ({ page }) => {
  await page.goto("/painel");

  for (const titulo of ["Onde os processos estão", "Por banco", "Por modalidade"]) {
    await expect(page.getByRole("heading", { name: titulo })).toBeVisible();
  }

  // Os números ficam em texto, não só no comprimento da barra: a leitura não
  // pode depender de medir no olho nem de enxergar cor.
  const fases = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Onde os processos estão" }) });

  await expect(fases.getByText("Captação do cliente")).toBeVisible();
  await expect(fases.getByRole("listitem").first()).toContainText(/\d/);
});
