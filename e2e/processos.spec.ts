import { expect, test } from "@playwright/test";

test("a lista de processos mostra a etapa em que cada um está", async ({ page }) => {
  await page.goto("/processos");

  await expect(page.getByRole("columnheader", { name: "Etapa" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Cliente" })).toBeVisible();
  // Não há mais Kanban nem fases: a lista é a única visão.
  await expect(page.getByRole("link", { name: "kanban" })).toHaveCount(0);
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
