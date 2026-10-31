import { expect, test } from "@playwright/test";

test("a lista de processos mostra a etapa em que cada um está", async ({ page }) => {
  await page.goto("/processos");

  await expect(page.getByRole("columnheader", { name: "Etapa" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Cliente" })).toBeVisible();
  // Não há mais Kanban nem fases: a lista é a única visão.
  await expect(page.getByRole("link", { name: "kanban" })).toHaveCount(0);
});

test("abre processo só com modalidade e participantes; o de maior renda vira o principal", async ({ page }) => {
  await page.goto("/processos/novo");

  // A tela de abertura não pede banco, valores nem imóvel.
  await expect(page.getByLabel("Valor do imóvel")).toHaveCount(0);

  await page.getByLabel("Modalidade").selectOption("construcao");
  await page.getByLabel("Proponente 1", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Adicionar proponente" }).click();
  await page.getByLabel("Proponente 2", { exact: true }).selectOption({ index: 2 });
  const principal = (await page.getByTestId("proponente-principal").innerText())
    .replace("Principal: ", "")
    .replace(" (maior renda)", "");

  await page.getByRole("button", { name: "Adicionar participante" }).click();
  await page.getByLabel("Papel do participante 1").selectOption("engenheiro");
  await page.getByLabel("Participante 1", { exact: true }).selectOption({ index: 3 });
  await page.getByRole("button", { name: "Criar processo" }).click();

  await expect(page).toHaveURL(/\/processos\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Processo #");
  await expect(page.getByLabel("Modalidade")).toHaveValue("construcao");

  const participantes = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Participantes" }) });
  await expect(
    participantes.getByRole("listitem").filter({ hasText: "Proponente principal" }),
  ).toContainText(principal);
  await expect(participantes.getByRole("listitem")).toHaveCount(3);
  await expect(participantes.getByText("Engenheiro")).toBeVisible();

  // Tirar o engenheiro pela própria tela do processo.
  await participantes.getByRole("button", { name: /Engenheiro\)$/ }).click();
  await expect(participantes.getByRole("listitem")).toHaveCount(2);
});

test("abrir processo sem modalidade ou sem proponente é recusado", async ({ page }) => {
  await page.goto("/processos/novo");
  await page.getByRole("button", { name: "Criar processo" }).click();

  await expect(page.getByText("Escolha a modalidade.")).toBeVisible();
  await expect(page.getByText("Informe pelo menos um proponente.")).toBeVisible();
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
