import { expect, test } from "@playwright/test";

// Este arquivo exercita o fluxo de login em si, então ignora a sessão
// compartilhada e começa sempre deslogado.
test.use({ storageState: { cookies: [], origins: [] } });

const EMAIL = process.env.SEED_USER_EMAIL ?? "dev@correspondente.local";
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "dev12345678";

/** O route announcer do Next também tem role="alert"; o nosso é o <p>. */
const formAlert = (page: import("@playwright/test").Page) => page.locator('p[role="alert"]');
const formStatus = (page: import("@playwright/test").Page) => page.locator('p[role="status"]');

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/painel");
}

test("rota protegida redireciona para o login preservando o destino", async ({ page }) => {
  await page.goto("/processos");
  await expect(page).toHaveURL(/\/login\?next=%2Fprocessos/);
});

test("credencial errada não entra e não revela se o e-mail existe", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha").fill("senha-errada-123");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(formAlert(page)).toHaveText("E-mail ou senha incorretos.");
  await expect(page).toHaveURL(/\/login/);
});

test("login entra no painel com o escritório do seed", async ({ page }) => {
  await login(page);

  await expect(page.getByRole("heading", { name: "Painel", level: 1 })).toBeVisible();
  await expect(page.getByRole("complementary").getByText("Escritório Demo")).toBeVisible();
  await expect(page.getByRole("link", { name: "Processos" })).toBeVisible();
});

test("dados do escritório salvam e persistem após recarregar", async ({ page }) => {
  await login(page);
  await page.goto("/configuracoes/escritorio");

  const code = `COD-${Date.now().toString().slice(-6)}`;
  await page.getByLabel("Código do correspondente").fill(code);
  await page.getByRole("button", { name: "Salvar alterações" }).click();

  await expect(formStatus(page)).toHaveText("Dados do escritório atualizados.");

  await page.reload();
  await expect(page.getByLabel("Código do correspondente")).toHaveValue(code);
});

test("CNPJ inválido é recusado com mensagem", async ({ page }) => {
  await login(page);
  await page.goto("/configuracoes/escritorio");

  await page.getByLabel("CNPJ").fill("11.222.333/0001-99");
  await page.getByRole("button", { name: "Salvar alterações" }).click();

  await expect(formAlert(page)).toHaveText("CNPJ inválido.");
});

test("sair encerra a sessão", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL("**/login");

  await page.goto("/painel");
  await expect(page).toHaveURL(/\/login/);
});
