import { expect, test, type Page } from "@playwright/test";

/**
 * Abre um processo novo e devolve a URL dele, para cada teste trabalhar num
 * registro só seu — o histórico é acumulativo e testes que compartilham
 * processo passariam a depender da ordem de execução.
 */
async function novoProcesso(page: Page): Promise<string> {
  await page.goto("/processos/novo");
  await page.getByLabel("Proponente principal").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Criar processo" }).click();
  await page.waitForURL(/\/processos\/[0-9a-f-]{36}/);
  return page.url();
}

test("a tela do processo é montada a partir do fluxo configurado", async ({ page }) => {
  await novoProcesso(page);

  const etapas = page.getByRole("navigation", { name: "Etapas do processo" });
  for (const etapa of [
    "Cadastro",
    "Correspondente",
    "Montagem",
    "Conformidade de contrato",
    "Agência",
    "CRI",
  ]) {
    await expect(etapas.getByRole("link", { name: etapa })).toBeVisible();
  }

  // Cada etapa tem campos próprios: os da análise de crédito não aparecem no
  // cadastro, que é a diferença entre esteira configurável e Kanban genérico.
  await expect(page.getByLabel("Valor do imóvel")).toBeVisible();
  await expect(page.getByLabel("Valor de avaliação")).toHaveCount(0);

  await etapas.getByRole("link", { name: "Correspondente" }).click();
  await expect(page.getByLabel("Valor de avaliação")).toBeVisible();
  await expect(page.getByLabel("Valor do imóvel")).toHaveCount(0);
});

test("salvar campo de etapa registra o de → para no histórico", async ({ page }) => {
  await novoProcesso(page);

  await page.getByLabel("Valor do imóvel").fill("R$ 350.000,00");
  await page.getByLabel("Indexador").fill("TR");
  await page.getByRole("button", { name: "Salvar etapa" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("2 campo(s) alterado(s)");

  await page.getByRole("link", { name: "Histórico" }).click();
  await expect(page.getByText("Valor do imóvel")).toBeVisible();
  // O histórico mostra o valor formatado, não os centavos crus do banco.
  await expect(page.getByText("R$ 350.000,00")).toBeVisible();
  await expect(page.getByText("Processo criado")).toBeVisible();
});

test("salvar sem alterar nada não sujeita o histórico", async ({ page }) => {
  const url = await novoProcesso(page);

  await page.getByLabel("Indexador").fill("IPCA");
  await page.getByRole("button", { name: "Salvar etapa" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("1 campo(s)");

  await page.goto(url);
  await page.getByRole("button", { name: "Salvar etapa" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("Nada mudou");
});

test("alteração seguinte guarda o valor anterior", async ({ page }) => {
  const url = await novoProcesso(page);

  await page.getByLabel("Indexador").fill("TR");
  await page.getByRole("button", { name: "Salvar etapa" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("1 campo(s)");

  await page.goto(url);
  await page.getByLabel("Indexador").fill("IPCA");
  await page.getByRole("button", { name: "Salvar etapa" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("1 campo(s)");

  await page.getByRole("link", { name: "Histórico" }).click();
  const linha = page.getByRole("listitem").filter({ hasText: "Indexador" }).first();
  await expect(linha).toContainText("TR");
  await expect(linha).toContainText("IPCA");
});

test("iniciar e finalizar etapa muda o estado e entra no histórico", async ({ page }) => {
  await novoProcesso(page);

  await page.getByRole("button", { name: "Iniciar etapa" }).click();
  await expect(page.getByText("Em andamento")).toBeVisible();

  await page.getByRole("button", { name: "Finalizar etapa" }).click();
  await expect(page.getByText("Concluída")).toBeVisible();

  await page.getByRole("link", { name: "Histórico" }).click();
  await expect(page.getByText("Etapa finalizada")).toBeVisible();
  await expect(page.getByText("Etapa iniciada")).toBeVisible();
});

test("trocar fase pelo cabeçalho vira evento com origem e destino", async ({ page }) => {
  await novoProcesso(page);

  await page.getByLabel("Fase do processo").selectOption("agencia");
  await expect(page.getByLabel("Fase do processo")).toHaveValue("agencia");

  await page.getByRole("link", { name: "Histórico" }).click();
  const linha = page.getByRole("listitem").filter({ hasText: "Fase" }).first();
  await expect(linha).toContainText("Cadastro");
  await expect(linha).toContainText("Agência");
});

test("campo de relação aparece pelo nome no histórico, não pelo id", async ({ page }) => {
  await novoProcesso(page);

  await page.getByLabel("Banco").selectOption({ label: "Caixa" });
  await page.getByRole("button", { name: "Salvar etapa" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("1 campo(s)");

  await page.getByRole("link", { name: "Histórico" }).click();
  const linha = page.getByRole("listitem").filter({ hasText: "Banco" }).first();
  await expect(linha).toContainText("Caixa");
  // Um uuid vazando na tela seria inútil para quem audita o processo.
  await expect(linha).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}/);
});
