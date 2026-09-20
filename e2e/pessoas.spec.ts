import { expect, test } from "@playwright/test";

const CPF_DO_SEED = "111.444.777-35";

/**
 * CPF fictício novo a cada execução: a suíte precisa poder rodar duas vezes
 * seguidas sem esbarrar no próprio cadastro anterior.
 */
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


test("busca encontra pessoa por nome e por CPF", async ({ page }) => {
  await page.goto("/pessoas");
  await expect(page.getByRole("link", { name: "ANA PAULA RIBEIRO" })).toBeVisible();

  await page.getByRole("searchbox").fill("bruno");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "BRUNO MARTINS DE SOUZA" })).toBeVisible();
  await expect(page.getByRole("link", { name: "ANA PAULA RIBEIRO" })).toHaveCount(0);

  await page.getByRole("searchbox").fill("111444");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "ANA PAULA RIBEIRO" })).toBeVisible();
});

test("CPF inválido é recusado antes de gravar", async ({ page }) => {
  await page.goto("/pessoas/nova");
  await page.getByLabel("CPF").fill("111.444.777-99");
  await page.getByLabel("Nome completo").fill("Teste CPF Invalido");
  await page.getByRole("button", { name: "Cadastrar pessoa" }).click();

  await expect(page.locator('p[role="alert"]')).toContainText("Revise os campos");
  await expect(page.getByText("CPF inválido.")).toBeVisible();
});

test("CPF repetido oferece abrir o cadastro existente em vez de duplicar", async ({ page }) => {
  await page.goto("/pessoas/nova");
  await page.getByLabel("CPF").fill(CPF_DO_SEED);
  await page.getByLabel("Nome completo").fill("Nome Diferente Mesmo CPF");
  await page.getByRole("button", { name: "Cadastrar pessoa" }).click();

  const alerta = page.locator('p[role="alert"]');
  await expect(alerta).toContainText("já está cadastrado com este CPF");

  // O link para o cadastro existente é o que evita o operador cadastrar de novo
  // com um dígito trocado só para "conseguir salvar".
  await alerta.getByRole("link", { name: "Abrir o cadastro existente" }).click();
  await expect(page).toHaveURL(/\/pessoas\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name: "ANA PAULA RIBEIRO" })).toBeVisible();
});

test("o bloco do cônjuge aparece conforme o estado civil", async ({ page }) => {
  await page.goto("/pessoas/nova");

  await expect(page.getByLabel("Nome do cônjuge/companheiro")).toHaveCount(0);

  await page.getByLabel("Estado civil").selectOption("casado_comunhao_parcial");
  await expect(page.getByLabel("Nome do cônjuge/companheiro")).toBeVisible();

  await page.getByLabel("Estado civil").selectOption("solteiro");
  await expect(page.getByLabel("Nome do cônjuge/companheiro")).toHaveCount(0);
});

test("cadastra pessoa e registra renda", async ({ page }) => {
  await page.goto("/pessoas/nova");
  await page.getByLabel("CPF").fill(cpfFicticio());
  const nome = `DANIELA FERRAZ CAMPOS ${Date.now().toString().slice(-5)}`;
  await page.getByLabel("Nome completo").fill(nome);
  await page.getByLabel("E-mail").fill("daniela.campos@exemplo.test");
  await page.getByLabel("Cidade", { exact: true }).fill("Santos");
  await page.getByRole("button", { name: "Cadastrar pessoa" }).click();

  await expect(page).toHaveURL(/\/pessoas\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name: nome })).toBeVisible();

  await page.getByRole("button", { name: "Adicionar renda" }).first().click();
  await page.getByLabel("Fonte pagadora").fill("EMPRESA EXEMPLO LTDA");
  await page.getByLabel("Renda bruta").fill("7.500,00");
  await page.getByRole("button", { name: "Adicionar renda" }).last().click();

  const linhaDaRenda = page.getByRole("listitem").filter({ hasText: "EMPRESA EXEMPLO LTDA" });
  await expect(linhaDaRenda).toBeVisible();
  // O valor volta formatado a partir dos centavos guardados no banco.
  await expect(linhaDaRenda).toContainText("R$ 7.500,00");
  await expect(page.getByText("renda bruta somada: R$ 7.500,00")).toBeVisible();
});

test("campos do documento mudam conforme o tipo, como no portal", async ({ page }) => {
  await page.goto("/pessoas/nova");

  // "Número" existe duas vezes na tela (documento e endereço): o escopo do
  // cartão evita casar com o campo errado.
  const documento = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Documento de identificação" }) });

  // O SICAQ troca o grupo inteiro de campos do documento: CNH pede data da
  // primeira habilitação, passaporte pede país de origem. O formulário daqui
  // acompanha, senão o cadastro sai incompleto para o preenchimento lá.
  await expect(documento.getByLabel("Data da primeira habilitação")).toHaveCount(0);
  await expect(documento.getByLabel("País de origem")).toHaveCount(0);

  await documento.getByLabel("Tipo", { exact: true }).selectOption("cnh");
  await expect(documento.getByLabel("Data da primeira habilitação")).toBeVisible();
  await expect(documento.getByLabel("País de origem")).toHaveCount(0);
  // O órgão emissor da CNH tem uma opção só no portal.
  await expect(documento.getByLabel("Órgão emissor").locator("option")).toHaveText([
    "—",
    "ÓRGÃO DE TRÂNSITO",
  ]);

  await documento.getByLabel("Tipo", { exact: true }).selectOption("passaporte");
  await expect(documento.getByLabel("País de origem")).toBeVisible();
  await expect(documento.getByLabel("Data da primeira habilitação")).toHaveCount(0);
  await expect(documento.getByLabel("Órgão emissor").locator("option")).toHaveText([
    "—",
    "POLÍCIA FEDERAL",
    "ÓRGÃO EMISSOR ESTRANGEIRO",
  ]);

  // RIC limita o número a 11 caracteres; RG aceita 15.
  await documento.getByLabel("Tipo", { exact: true }).selectOption("ric");
  await expect(documento.getByLabel("Número")).toHaveAttribute("maxlength", "11");
  await documento.getByLabel("Tipo", { exact: true }).selectOption("rg");
  await expect(documento.getByLabel("Número")).toHaveAttribute("maxlength", "15");
});

test("nacionalidade estrangeira exige o país", async ({ page }) => {
  await page.goto("/pessoas/nova");

  await expect(page.getByLabel("País de nacionalidade")).toHaveCount(0);
  await page.getByLabel("Nacionalidade").selectOption("estrangeiro");
  await expect(page.getByLabel("País de nacionalidade")).toBeVisible();

  await page.getByLabel("CPF").fill(cpfFicticio());
  await page.getByLabel("Nome completo").fill("PESSOA ESTRANGEIRA TESTE");
  await page.getByRole("button", { name: "Cadastrar pessoa" }).click();

  await expect(page.getByText("Informe o país de nacionalidade.")).toBeVisible();
});
