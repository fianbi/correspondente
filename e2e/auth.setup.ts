import { test as setup, expect } from "@playwright/test";
import { STORAGE_STATE } from "./paths";

const EMAIL = process.env.SEED_USER_EMAIL ?? "dev@correspondente.local";
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "dev12345678";

/**
 * Faz login uma única vez e guarda os cookies para os demais testes.
 *
 * Sem isso, cada teste abriria uma sessão nova e a suíte batia no rate limit de
 * sign-in do Supabase local (`sign_in_sign_ups`, 5 em 5 minutos) — as falhas
 * apareciam como "senha incorreta" em testes que não têm nada a ver com login.
 */
setup("autentica uma vez e guarda a sessão", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  await page.waitForURL("**/painel");
  await expect(page.getByRole("heading", { name: "Painel", level: 1 })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
