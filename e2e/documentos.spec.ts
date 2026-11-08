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
  // O nome do arquivo aparece já durante o envio; só "Enviado" garante que o
  // documento foi registrado. Sair antes disso cortava o registro no meio.
  await expect(page.getByText("Enviado", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

test("checklist da etapa mostra o que falta e marca o que chegou", async ({ page }) => {
  const url = await novoProcesso(page);
  await page.goto(`${url}?aba=documentos`);

  // A primeira lista da página é a navegação de etapas; o checklist é o cartão
  // que tem o próprio título.
  const checklist = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /O que a etapa pede/ }) });

  await expect(checklist).toBeVisible();
  await expect(checklist.getByText("RG", { exact: true })).toBeVisible();

  // Documento pessoal vale em todos os processos da pessoa, então o que já
  // falta depende do que a base tem: pega o primeiro item em aberto.
  const pendentes = checklist.getByRole("button", { name: /^Enviar / });
  const antes = await pendentes.count();
  expect(antes).toBeGreaterThan(0);

  // "Enviar" no item já deixa o tipo escolhido no formulário de envio.
  await pendentes.first().click();
  await expect(page.getByLabel("Tipo", { exact: true })).not.toHaveValue("");
  const arquivo = `checklist-${randomUUID().slice(0, 8)}.pdf`;
  await enviarArquivo(page, arquivo);

  await expect(page.getByRole("button", { name: arquivo })).toBeVisible({ timeout: 15_000 });
  // O mesmo checklist agora marca o item como recebido.
  await expect(pendentes).toHaveCount(antes - 1);
});

test("documento pode ser aprovado e rejeitado", async ({ page }) => {
  const holerite = `holerite-${randomUUID().slice(0, 8)}.pdf`;
  const url = await novoProcesso(page);
  await page.goto(`${url}?aba=documentos`);

  await page.getByLabel("Tipo", { exact: true }).selectOption("comprovante_renda");
  await enviarArquivo(page, holerite);
  await expect(page.getByRole("button", { name: holerite })).toBeVisible({ timeout: 15_000 });

  const linha = page.getByRole("listitem").filter({ hasText: holerite });
  await linha.getByRole("button", { name: "Aprovar" }).click();
  await expect(linha.getByText("Aprovado")).toBeVisible();

  await linha.getByRole("button", { name: "Rejeitar" }).click();
  await linha.getByLabel("Motivo da rejeição").fill("ilegível");
  await linha.getByRole("button", { name: "Confirmar rejeição" }).click();
  await expect(linha.getByText("Rejeitado")).toBeVisible();
  await expect(linha.getByText("Motivo: ilegível")).toBeVisible();
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
  // Espera a ação gravar antes de sair da página.
  await expect(
    page.getByRole("listitem").filter({ hasText: titulo }).getByRole("button", { name: "Reabrir pendência" }),
  ).toBeVisible();

  await page.goto("/pendencias");
  await expect(page.getByText(titulo)).toHaveCount(0);
});

test("link de acesso abre o portal do terceiro e aceita envio", async ({ page, context }) => {
  const rgCliente = `rg-cliente-${randomUUID().slice(0, 8)}.pdf`;
  const url = await novoProcesso(page);
  await page.goto(`${url}?aba=documentos`);

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
    name: rgCliente,
    mimeType: "application/pdf",
    buffer: PDF_MINIMO,
  });

  await expect(visitante.getByText("Documento enviado")).toBeVisible({ timeout: 15_000 });
  await visitante.reload();
  await expect(visitante.getByText(rgCliente)).toBeVisible();

  await anonimo.close();

  // Do lado do escritório, o envio chega identificado pela origem.
  await page.goto(`${url}?aba=documentos`);
  await expect(page.getByRole("button", { name: rgCliente })).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: rgCliente }).getByText("enviado por Ana Paula"),
  ).toBeVisible();
});

test("link revogado deixa de abrir", async ({ page, context }) => {
  const url = await novoProcesso(page);
  await page.goto(`${url}?aba=documentos`);

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

test("documento pessoal enviado no processo aparece na pessoa", async ({ page }) => {
  const cnh = `cnh-${randomUUID().slice(0, 8)}.pdf`;
  const url = await novoProcesso(page);
  await page.goto(`${url}?aba=documentos`);

  await page.getByLabel("Tipo", { exact: true }).selectOption("cnh");
  const dono = page.getByLabel("De quem é");
  const pessoaId = await dono.inputValue();
  await enviarArquivo(page, cnh);
  await expect(page.getByRole("button", { name: cnh })).toBeVisible({ timeout: 15_000 });

  // Matrícula puxa o dono para o processo sozinha.
  await page.getByLabel("Tipo", { exact: true }).selectOption("matricula_imovel");
  await expect(dono).toHaveValue("processo");

  await page.goto(`/pessoas/${pessoaId}?aba=documentos`);
  await expect(page.getByRole("button", { name: cnh }).first()).toBeVisible();
});

test("área separada de documentos não existe mais", async ({ page }) => {
  await page.goto("/documentos");
  await expect(page).toHaveURL(/\/processos$/);
  await expect(page.getByRole("navigation", { name: "Navegação principal" }).getByText("Documentos")).toHaveCount(0);
});

test("token inventado não abre portal nenhum", async ({ page }) => {
  const response = await page.goto("/p/token-invalido-porem-comprido-o-bastante-xyz");
  expect(response?.status()).toBe(404);
});
