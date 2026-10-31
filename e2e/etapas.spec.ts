import { expect, test, type Page } from "@playwright/test";

/**
 * Abre um processo novo e devolve a URL dele, para cada teste trabalhar num
 * registro só seu — o histórico é acumulativo e testes que compartilham
 * processo passariam a depender da ordem de execução.
 */
async function novoProcesso(page: Page): Promise<string> {
  await page.goto("/processos/novo");
  await page.getByLabel("Modalidade").selectOption("aquisicao_imovel_usado");
  await page.getByLabel("Proponente 1", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Criar processo" }).click();
  await page.waitForURL(/\/processos\/[0-9a-f-]{36}/);
  return page.url();
}

test("a tela do processo é montada a partir do fluxo configurado", async ({ page }) => {
  await novoProcesso(page);

  const etapas = page.getByRole("navigation", { name: "Etapas do processo" });
  for (const etapa of [
    "Captação do cliente",
    "Avaliação de risco",
    "Vistoria da engenharia Caixa",
    "Envio para conformidade",
    "Registro em cartório de imóveis",
  ]) {
    await expect(etapas.getByRole("link", { name: etapa })).toBeVisible();
  }

  // Cada etapa mostra os campos do seu momento: os da análise de crédito não
  // aparecem na captação.
  await expect(page.getByLabel("Valor do imóvel")).toBeVisible();
  await expect(page.getByLabel("Valor de avaliação")).toHaveCount(0);

  await etapas.getByRole("link", { name: "Avaliação de risco" }).click();
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


test("trocar a etapa pelo cabeçalho vira evento com origem e destino", async ({ page }) => {
  await novoProcesso(page);

  await page.getByLabel("Etapa do processo").selectOption("revisao_gerente");
  await expect(page.getByLabel("Etapa do processo")).toHaveValue("revisao_gerente");

  await page.getByRole("link", { name: "Histórico" }).click();
  // O menu lateral também é lista: o histórico é a linha com origem e destino.
  const linha = page
    .getByRole("listitem")
    .filter({ hasText: "Captação do cliente" })
    .filter({ hasText: "Revisão final pelo gerente da agência" })
    .first();
  await expect(linha).toContainText("Etapa");
  await expect(linha).toContainText("Revisão final pelo gerente da agência");
});

test("as etapas seguem a modalidade, com desvio que volta para quem o abriu", async ({ page }) => {
  await novoProcesso(page);
  const etapas = page.getByRole("navigation", { name: "Etapas do processo" });

  await page.getByRole("button", { name: "Concluir etapa" }).click();
  await expect(page.getByLabel("Etapa do processo")).toHaveValue("simulacao");

  // Construção tem engenharia local e PEPT; o roteiro troca com a modalidade.
  await expect(etapas.getByRole("link", { name: "Projeto de engenharia e aprovação na prefeitura" })).toHaveCount(0);
  await page.getByLabel("Modalidade").selectOption("aquisicao_terreno_construcao");
  await page.getByRole("button", { name: "Salvar etapa" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("1 campo(s)");
  await expect(etapas.getByRole("link", { name: "Projeto de engenharia e aprovação na prefeitura" })).toBeVisible();

  // Abrir outra etapa só mostra; mover é um clique explícito.
  await etapas.getByRole("link", { name: "Vistoria da engenharia Caixa" }).click();
  await expect(page.getByLabel("Etapa do processo")).toHaveValue("simulacao");
  await page.getByRole("button", { name: "Mover processo para esta etapa" }).click();
  await expect(page.getByLabel("Etapa do processo")).toHaveValue("vistoria_engenharia");

  // PEPT só aparece no menu depois de acontecer.
  await expect(etapas.getByRole("link", { name: "Ajustes de projeto (PEPT)" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ajustes de projeto (PEPT)" }).click();
  await expect(page.getByLabel("Etapa do processo")).toHaveValue("ajustes_pept");
  await etapas.getByRole("link", { name: "Ajustes de projeto (PEPT)" }).click();
  await page.getByRole("button", { name: "Voltar para Vistoria da engenharia Caixa" }).click();
  await expect(page.getByLabel("Etapa do processo")).toHaveValue("vistoria_engenharia");
  await expect(etapas.getByRole("link", { name: "Ajustes de projeto (PEPT)" })).toBeVisible();
});
