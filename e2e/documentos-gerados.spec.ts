import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

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

test("modelo pronto da Caixa gera o formulário com cadastro e respostas", async ({
  page,
  request,
}) => {
  await page.goto("/configuracoes/formularios");
  const pronto = page.locator("section").filter({ hasText: "Modelos prontos" });
  await pronto.getByRole("button", { name: /Adicionar|Atualizar/ }).first().click();
  await expect(pronto.locator(String.raw`p[role="status"]`)).toBeVisible();

  // Do lado do processo, as perguntas aparecem antes de gerar.
  const url = await primeiroProcesso(page);
  await page.getByRole("group").filter({ hasText: "Gerar PDF" }).click();
  await page.getByRole("button", { name: /MO43047011/ }).click();
  await expect(page.getByLabel("Cartão de Crédito")).toBeVisible();
  await expect(page.getByLabel("EGI")).toBeVisible();

  const id = /\/processos\/([0-9a-f-]{36})/.exec(url)![1];
  const modelo = await page.locator("form[action*='/formularios/']").getAttribute("action");
  expect(modelo).toContain(`/processos/${id}/formularios/`);

  const resposta = await request.get(
    `${modelo}?${new URLSearchParams({ "m:Cartão de Crédito": "1", "o:Programa habitacional": "SBPE" })}`,
  );
  expect(resposta.status()).toBe(200);

  expect(resposta.headers()["content-type"]).toContain("application/pdf");
  // Os valores são escritos sobre o fundo do formulário (conteúdo e posição
  // são conferidos no teste de unidade); aqui basta o PDF sair inteiro.
  const doc = await PDFDocument.load(await resposta.body());
  expect(doc.getPageCount()).toBe(1);
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

  await expect(fases.getByText("Documentação pessoal e dados cadastrais")).toBeVisible();
  await expect(fases.getByRole("listitem").first()).toContainText(/\d/);
});
