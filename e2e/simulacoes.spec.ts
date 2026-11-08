import { expect, test } from "@playwright/test";

/** CPF fictício novo a cada execução, para a suíte poder rodar de novo. */
function cpfFicticio(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
  const digito = (parcial: string, peso: number) => {
    const soma = parcial.split("").reduce((acc, d, i) => acc + Number(d) * (peso - i), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(base, 10);
  return `${base}${d1}${digito(`${base}${d1}`, 11)}`;
}

test("simulação sem cadastro vira processo com a pessoa criada e o cenário escolhido", async ({ page }) => {
  const nome = `CLIENTE SIMULOU ${Date.now().toString().slice(-5)}`;

  await page.goto("/simulacoes");
  await page.getByRole("link", { name: "Nova simulação" }).click();
  await page.getByLabel("Nome do cliente").fill(nome);
  await page.getByLabel("Telefone").fill("(11) 98888-7777");
  await page.getByLabel("Renda bruta mensal (soma dos proponentes)").fill("6.500,00");
  await page.getByLabel("Valor do imóvel").fill("300.000,00");
  await page.getByLabel("Já tem imóvel").selectOption("nao");

  await page.getByLabel("Valor financiado do cenário 1").fill("240000");
  await page.getByLabel("Prazo do cenário 1").fill("420");
  await page.getByRole("button", { name: "Adicionar cenário" }).click();
  await page.getByLabel("Valor financiado do cenário 2").fill("250000");
  await page.getByLabel("Prazo do cenário 2").fill("360");
  await page.getByLabel("Cenário 2 escolhido").check();
  await page.getByRole("button", { name: "Criar simulação" }).click();

  await expect(page).toHaveURL(/\/simulacoes\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(nome);
  await expect(page.getByLabel("Cenário 2 escolhido")).toBeChecked();

  await page.getByRole("link", { name: "Abrir processo" }).click();
  await page.getByLabel("CPF do cliente").fill(cpfFicticio());
  await page.getByLabel("Modalidade").selectOption("aquisicao_imovel_usado");
  await page.getByRole("button", { name: "Criar processo" }).click();

  await expect(page).toHaveURL(/\/processos\/[0-9a-f-]{36}/);
  await expect(page.getByText("Nasceu da simulação de")).toBeVisible();
  await expect(page.getByLabel("Etapa do processo")).toHaveValue("documentacao_pessoal");
  const participantes = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Participantes" }) });
  await expect(participantes).toContainText(nome);
  // O cenário escolhido vira o valor inicial da proposta.
  await expect(page.getByLabel("Valor de financiamento")).toHaveValue("250000,00");

  await page.goto("/simulacoes");
  await expect(page.getByRole("row").filter({ hasText: nome })).toContainText("Virou o processo #");
});
