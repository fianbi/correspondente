import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

/** PDF mínimo válido, para o upload exercitar o caminho real de armazenamento. */
const PDF_MINIMO = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n",
);

async function novoProcesso(page: Page): Promise<string> {
  await page.goto("/processos/novo");
  await page.getByLabel("Modalidade").selectOption("aquisicao_imovel_usado");
  await page.getByLabel("Proponente 1", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Criar processo" }).click();
  await page.waitForURL(/\/processos\/[0-9a-f-]{36}/);
  return page.url().split("?")[0]!;
}

async function enviarArquivo(page: Page, nome: string) {
  await page.getByLabel("Arquivo").setInputFiles({
    name: nome,
    mimeType: "application/pdf",
    buffer: PDF_MINIMO,
  });
}

test("checklist da etapa mostra o que falta e marca o que chegou", async ({ page }) => {
  const url = await novoProcesso(page);
  await page.goto(`${url}?aba=documentos`);

  // A primeira lista da página é a navegação de etapas; o checklist é o cartão
  // que tem o próprio título.
  const checklist = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Checklist da etapa" }) });

  await expect(checklist).toBeVisible();
  await expect(checklist.getByText("RG", { exact: true })).toBeVisible();
  await expect(checklist.getByText("Falta").first()).toBeVisible();

  await page.getByLabel("Tipo", { exact: true }).selectOption("rg");
  await enviarArquivo(page, "rg.pdf");

  await expect(page.getByText("rg.pdf")).toBeVisible({ timeout: 15_000 });
  // O mesmo checklist agora marca o item como recebido.
  await expect(checklist.getByText("Recebido").first()).toBeVisible();
});

test("documento pode ser aprovado e rejeitado", async ({ page }) => {
  const url = await novoProcesso(page);
  await page.goto(`${url}?aba=documentos`);

  await page.getByLabel("Tipo", { exact: true }).selectOption("comprovante_renda");
  await enviarArquivo(page, "holerite.pdf");
  await expect(page.getByText("holerite.pdf")).toBeVisible({ timeout: 15_000 });

  const linha = page.getByRole("listitem").filter({ hasText: "holerite.pdf" });
  await linha.getByRole("button", { name: "Aprovar" }).click();
  await expect(linha.getByText("Aprovado")).toBeVisible();

  await linha.getByRole("button", { name: "Rejeitar" }).click();
  await expect(linha.getByText("Rejeitado")).toBeVisible();
});

test("pendência aparece na visão global e some ao ser resolvida", async ({ page }) => {
  const url = await novoProcesso(page);
  await page.goto(`${url}?aba=pendencias`);

  // Título único por execução: a base de desenvolvimento acumula pendências
  // de rodadas anteriores, e um sufixo curto acabaria colidindo.
  const titulo = `Falta certidão ${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Nova pendência").fill(titulo);
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText(titulo)).toBeVisible();

  await page.goto("/pendencias");
  await expect(page.getByText(titulo)).toBeVisible();

  await page.goto(`${url}?aba=pendencias`);
  await page
    .getByRole("listitem")
    .filter({ hasText: titulo })
    .getByRole("button", { name: "Marcar como resolvida" })
    .click();

  await page.goto("/pendencias");
  await expect(page.getByText(titulo)).toHaveCount(0);
});

test("link de acesso abre o portal do terceiro e aceita envio", async ({ page, context }) => {
  const url = await novoProcesso(page);
  await page.goto(`${url}?aba=pendencias`);

  await page.getByLabel("Para quem é o link").fill("Cliente — teste");
  await page.getByRole("button", { name: "Gerar link" }).click();

  const codigo = page.locator("code");
  await expect(codigo).toBeVisible();
  const portalUrl = (await codigo.innerText()).trim();
  expect(portalUrl).toContain("/p/");

  // Contexto anônimo: o portal não pode depender da sessão da equipe.
  const anonimo = await context.browser()!.newContext();
  const visitante = await anonimo.newPage();
  await visitante.goto(portalUrl);

  await expect(visitante.getByRole("heading", { name: /Processo #/ })).toBeVisible();
  await expect(visitante.getByText("Andamento")).toBeVisible();
  // Nada de valores ou dados internos no portal do cliente.
  await expect(visitante.getByText("Valor de financiamento")).toHaveCount(0);

  await visitante.getByLabel("Seu nome").fill("Ana Paula");
  await visitante.getByLabel("Tipo de documento").selectOption("rg");
  await visitante.getByLabel("Arquivo").setInputFiles({
    name: "rg-cliente.pdf",
    mimeType: "application/pdf",
    buffer: PDF_MINIMO,
  });

  await expect(visitante.getByText("Documento enviado")).toBeVisible({ timeout: 15_000 });
  await visitante.reload();
  await expect(visitante.getByText("rg-cliente.pdf")).toBeVisible();

  await anonimo.close();

  // Do lado do escritório, o envio chega identificado pela origem.
  await page.goto(`${url}?aba=documentos`);
  await expect(page.getByText("rg-cliente.pdf")).toBeVisible();
  await expect(page.getByText("enviado por Ana Paula")).toBeVisible();
});

test("link revogado deixa de abrir", async ({ page, context }) => {
  const url = await novoProcesso(page);
  await page.goto(`${url}?aba=pendencias`);

  await page.getByLabel("Para quem é o link").fill("Para revogar");
  await page.getByRole("button", { name: "Gerar link" }).click();
  const portalUrl = (await page.locator("code").innerText()).trim();

  await page
    .getByRole("listitem")
    .filter({ hasText: "Para revogar" })
    .getByRole("button", { name: "Revogar" })
    .click();
  await expect(page.getByText("Revogado")).toBeVisible();

  const anonimo = await context.browser()!.newContext();
  const visitante = await anonimo.newPage();
  const response = await visitante.goto(portalUrl);
  expect(response?.status()).toBe(404);
  await anonimo.close();
});

test("token inventado não abre portal nenhum", async ({ page }) => {
  const response = await page.goto("/p/token-invalido-porem-comprido-o-bastante-xyz");
  expect(response?.status()).toBe(404);
});
