import { expect, test } from "@playwright/test";


test("Kanban mostra todas as fases do funil, inclusive as vazias", async ({ page }) => {
  await page.goto("/processos?view=kanban");

  for (const fase of [
    "Cadastro",
    "Correspondente",
    "Montagem",
    "Conformidade de contrato",
    "Agência",
    "CRI",
  ]) {
    await expect(page.getByRole("region", { name: fase })).toBeVisible();
  }
});

test("alterna entre Kanban e tabela", async ({ page }) => {
  await page.goto("/processos?view=kanban");
  await page.getByRole("link", { name: "tabela" }).click();

  await expect(page).toHaveURL(/view=tabela/);
  await expect(page.getByRole("columnheader", { name: "Cliente" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Financiamento" })).toBeVisible();
});

test("mover de fase no Kanban persiste depois de recarregar", async ({ page }) => {
  await page.goto("/processos?view=kanban");

  const cadastro = page.getByRole("region", { name: "Cadastro" });
  const card = cadastro.getByRole("article").first();
  const titulo = await card.getByRole("link").first().innerText();

  await card.getByRole("combobox").selectOption("cri");

  const cri = page.getByRole("region", { name: "CRI" });
  await expect(cri.getByRole("link", { name: titulo })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("region", { name: "CRI" }).getByRole("link", { name: titulo })).toBeVisible();

  // Devolve para a fase original, para a suíte poder rodar de novo sem depender
  // de reseed.
  await page
    .getByRole("region", { name: "CRI" })
    .getByRole("article")
    .filter({ hasText: titulo })
    .getByRole("combobox")
    .selectOption("cadastro");
  await expect(page.getByRole("region", { name: "Cadastro" }).getByRole("link", { name: titulo })).toBeVisible();
});

test("cria processo com valor em reais e mostra formatado", async ({ page }) => {
  await page.goto("/processos/novo");

  await page.getByLabel("Proponente principal").selectOption({ index: 1 });
  await page.getByLabel("Modalidade").selectOption("construcao");
  await page.getByLabel("Valor do imóvel").fill("R$ 512.345,67");
  await page.getByLabel("Valor de financiamento").fill("400000");
  await page.getByRole("button", { name: "Criar processo" }).click();

  await expect(page).toHaveURL(/\/processos\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Processo #");

  // Ida e volta pelo parser de moeda: entrou com máscara, voltou sem perder centavo.
  await expect(page.getByLabel("Valor do imóvel")).toHaveValue("512345,67");
  await expect(page.getByLabel("Valor de financiamento")).toHaveValue("400000,00");
});

test("processo aparece no painel somando por status", async ({ page }) => {
  await page.goto("/painel");

  const cardEmAberto = page.getByText("Em aberto").locator("..");
  await expect(cardEmAberto).toContainText("processo(s)");
  await expect(cardEmAberto).toContainText("R$");
});

test("processo de outro escritório dá 404 pela URL", async ({ page }) => {
  // UUID válido que não pertence a este escritório: a RLS devolve vazio e a
  // página responde 404 em vez de vazar a existência do registro.
  const response = await page.goto("/processos/00000000-0000-4000-8000-000000000000");
  expect(response?.status()).toBe(404);
});
