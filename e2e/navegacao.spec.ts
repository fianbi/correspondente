import { expect, test } from "@playwright/test";

test("no celular o menu abre pelo botão do topo e fecha ao trocar de tela", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/painel");

  await expect(page.getByRole("complementary")).toBeHidden();
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await menu.getByRole("link", { name: "Pessoas" }).click();

  await expect(page).toHaveURL(/\/pessoas$/);
  await expect(menu).toBeHidden();
});
