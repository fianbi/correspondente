import { expect, test } from "@playwright/test";

test("convite da equipe gera o link, fica pendente e pode ser cancelado", async ({ page }) => {
  await page.goto("/configuracoes/escritorio");
  const email = `convidado-${Date.now()}@exemplo.test`;

  await page.getByLabel("E-mail de quem vai entrar").fill(email);
  await page.getByLabel("Papel", { exact: true }).selectOption("analista");
  await page.getByRole("button", { name: "Gerar convite" }).click();

  await expect(page.getByText("Copie agora")).toBeVisible();
  await expect(page.locator("code")).toContainText("/convite/");

  const pendente = page.getByRole("listitem").filter({ hasText: email });
  await expect(pendente).toContainText("Convite pendente · Analista");
  await pendente.getByRole("button", { name: "Cancelar convite" }).click();
  await expect(pendente).toHaveCount(0);
});

test("link de convite inválido explica em vez de quebrar", async ({ page }) => {
  await page.goto("/convite/link-que-nao-existe-de-jeito-nenhum");
  await expect(page.getByText("Este link de convite não existe")).toBeVisible();
});
