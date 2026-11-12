import { expect, test, type Page } from "@playwright/test";

/**
 * Abre um processo novo e devolve a URL dele, para cada teste trabalhar num
 * registro só seu — o histórico é acumulativo e testes que compartilham
 * processo passariam a depender da ordem de execução.
 */
/** Etapa em que o processo está, pela barra de etapas. */
function etapaAtual(page: Page) {
  return page.getByRole("navigation", { name: "Etapas do processo" });
}

/** Abre a seção Histórico, recolhida no fim da tela, e devolve só ela. */
async function abrirHistorico(page: Page) {
  const secao = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Histórico" }) });
  await secao.locator("summary").click();
  return secao;
}

async function novoProcesso(page: Page, etapa?: string): Promise<string> {
  await page.goto("/processos/novo");
  await page.getByLabel("Modalidade").selectOption("aquisicao_imovel_usado");
  await page.getByLabel("Proponente 1", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Criar processo" }).click();
  await page.waitForURL(/\/processos\/[0-9a-f-]{36}/);
  if (!etapa) return page.url();
  // Abre direto a etapa pedida, para o teste não depender de qual é a atual.
  const url = `${page.url().split("?")[0]}?etapa=${etapa}`;
  await page.goto(url);
  return url;
}

test("a tela do processo é montada a partir do fluxo configurado", async ({ page }) => {
  await novoProcesso(page);

  const etapas = page.getByRole("navigation", { name: "Etapas do processo" });
  for (const etapa of [
    "Documentação pessoal e dados cadastrais",
    "Avaliação de risco",
    "Vistoria da engenharia Caixa",
    "Envio para conformidade",
    "Registro em cartório de imóveis",
  ]) {
    await expect(etapas.getByRole("link", { name: etapa })).toBeVisible();
  }

  // Cada etapa mostra só os campos dela: os da avaliação de risco não
  // aparecem na documentação, e vice-versa.
  await expect(page.getByLabel("Valor do imóvel")).toBeVisible();
  await expect(page.getByLabel("Valor aprovado")).toHaveCount(0);

  await etapas.getByRole("link", { name: "Avaliação de risco" }).click();
  await expect(page.getByLabel("Valor aprovado")).toBeVisible();
  await expect(page.getByLabel("Valor do imóvel")).toHaveCount(0);
  await expect(page.getByLabel("Valor de avaliação")).toHaveCount(0);
});

test("salvar campo de etapa registra o de → para no histórico", async ({ page }) => {
  await novoProcesso(page, "documentacao_pessoal");

  await page.getByLabel("Valor do imóvel").fill("R$ 350.000,00");
  await page.getByLabel("Valor de financiamento").fill("R$ 280.000,00");
  await page.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("2 campo(s) alterado(s)");

  const historico = await abrirHistorico(page);
  await expect(historico.getByText("Valor do imóvel")).toBeVisible();
  // O histórico mostra o valor formatado, não os centavos crus do banco.
  await expect(historico.getByText("R$ 350.000,00")).toBeVisible();
  await expect(historico.getByText("Processo criado")).toBeVisible();
});

test("salvar sem alterar nada não sujeita o histórico", async ({ page }) => {
  const url = await novoProcesso(page, "proposta_siopi");

  await page.getByLabel("Indexador").fill("IPCA");
  await page.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("1 campo(s)");

  await page.goto(url);
  await page.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("Nada mudou");
});

test("alteração seguinte guarda o valor anterior", async ({ page }) => {
  const url = await novoProcesso(page, "proposta_siopi");

  await page.getByLabel("Indexador").fill("TR");
  await page.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("1 campo(s)");

  await page.goto(url);
  await page.getByLabel("Indexador").fill("IPCA");
  await page.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("1 campo(s)");

  const historico = await abrirHistorico(page);
  const linha = historico.getByRole("listitem").filter({ hasText: "Indexador" }).first();
  await expect(linha).toContainText("TR");
  await expect(linha).toContainText("IPCA");
});

test("campo de relação aparece pelo nome no histórico, não pelo id", async ({ page }) => {
  await novoProcesso(page, "documentacao_pessoal");

  await page.getByLabel("Banco").selectOption({ label: "Caixa" });
  await page.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("1 campo(s)");

  const historico = await abrirHistorico(page);
  const linha = historico.getByRole("listitem").filter({ hasText: "Banco" }).first();
  await expect(linha).toContainText("Caixa");
  // Um uuid vazando na tela seria inútil para quem audita o processo.
  await expect(linha).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}/);
});

test("mover o processo de etapa vira evento com origem e destino", async ({ page }) => {
  await novoProcesso(page, "revisao_gerente");

  await page.getByRole("button", { name: "Mover processo para esta etapa" }).click();
  await expect(etapaAtual(page)).toHaveAttribute("data-etapa-atual", "revisao_gerente");

  const historico = await abrirHistorico(page);
  // A barra de etapas também é lista: o histórico é a linha com origem e destino.
  const linha = historico
    .getByRole("listitem")
    .filter({ hasText: "Documentação pessoal e dados cadastrais" })
    .filter({ hasText: "Revisão final pelo gerente da agência" })
    .first();
  await expect(linha).toContainText("Etapa");
  await expect(linha).toContainText("Revisão final pelo gerente da agência");
});

test("as etapas seguem a modalidade, com desvio que volta para quem o abriu", async ({ page }) => {
  await novoProcesso(page);
  const etapas = page.getByRole("navigation", { name: "Etapas do processo" });

  await page.getByRole("button", { name: "Concluir etapa" }).click();
  await expect(etapaAtual(page)).toHaveAttribute("data-etapa-atual", "analise_risco");

  // Construção tem engenharia local e PEPT; o roteiro troca com a modalidade.
  await expect(
    etapas.getByRole("link", {
      name: "Projeto de engenharia e aprovação na prefeitura",
    }),
  ).toHaveCount(0);
  // A modalidade fica no negócio, na etapa de documentação.
  await etapas.getByRole("link", { name: "Documentação pessoal e dados cadastrais" }).click();
  await page.getByLabel("Modalidade").selectOption("aquisicao_terreno_construcao");
  await page.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.locator('p[role="status"]')).toContainText("1 campo(s)");
  await expect(
    etapas.getByRole("link", {
      name: "Projeto de engenharia e aprovação na prefeitura",
    }),
  ).toBeVisible();

  // Abrir outra etapa só mostra; mover é um clique explícito.
  await etapas.getByRole("link", { name: "Vistoria da engenharia Caixa" }).click();
  await expect(page).toHaveURL(/etapa=vistoria_engenharia/);
  await expect(etapaAtual(page)).toHaveAttribute("data-etapa-atual", "analise_risco");
  await page.getByRole("button", { name: "Mover processo para esta etapa" }).click();
  await expect(etapaAtual(page)).toHaveAttribute("data-etapa-atual", "vistoria_engenharia");

  // PEPT só aparece na barra depois de acontecer.
  await expect(etapas.getByRole("link", { name: "Ajustes de projeto (PEPT)" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ajustes de projeto (PEPT)" }).click();
  await expect(etapaAtual(page)).toHaveAttribute("data-etapa-atual", "ajustes_pept");
  await etapas.getByRole("link", { name: "Ajustes de projeto (PEPT)" }).click();
  await page.getByRole("button", { name: "Voltar para Vistoria da engenharia Caixa" }).click();
  await expect(etapaAtual(page)).toHaveAttribute("data-etapa-atual", "vistoria_engenharia");
  await expect(etapas.getByRole("link", { name: "Ajustes de projeto (PEPT)" })).toBeVisible();
});

test("agência nova é cadastrada no processo e depois escolhida pelo nome", async ({ page }) => {
  const url = await novoProcesso(page, "documentacao_pessoal");
  const numero = String(1000 + Math.floor(Math.random() * 8999));

  await page.getByLabel("Banco").selectOption({ label: "Caixa" });
  await page.getByLabel("Agência", { exact: true }).fill(numero);
  await page.getByLabel("Nome da agência nova").fill(`Teste ${numero}`);
  await page.getByLabel("Cidade", { exact: true }).fill("Florianópolis");
  await page.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.locator('p[role="status"]')).toBeVisible();

  await page.goto(url);
  await expect(page.getByLabel("Agência", { exact: true })).toHaveValue(
    `${numero} — Teste ${numero} (Florianópolis)`,
  );

  // Outro processo acha a mesma agência pelo nome, sem cadastrar de novo.
  await novoProcesso(page, "documentacao_pessoal");
  await page.getByLabel("Agência", { exact: true }).fill(`Teste ${numero}`);
  await expect(page.getByLabel("Nome da agência nova")).toHaveCount(0);
  await page.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.locator('p[role="status"]')).toBeVisible();

  await page.goto("/configuracoes/agencias");
  const linha = page.getByRole("listitem").filter({ hasText: `Teste ${numero}` });
  await expect(linha).toContainText("Florianópolis");
  await expect(linha.getByRole("link", { name: "2 processos" })).toBeVisible();
});
