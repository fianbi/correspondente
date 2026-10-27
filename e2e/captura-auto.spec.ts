import { expect, test } from "@playwright/test";

/**
 * Captura automática da extensão: a tela do portal chega com o CPF da sessão
 * de cadastro, sem processo escolhido, e completa o cadastro dessa pessoa.
 */

const ORIGEM_EXTENSAO = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
const headers = { origin: ORIGEM_EXTENSAO, "content-type": "application/json" };

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

test("completa o cadastro achado pelo CPF, sem sobrescrever e sem repetir", async ({
  page,
  request,
}) => {
  const cpf = cpfFicticio();
  const nome = `CAPTURA AUTOMATICA ${Date.now().toString().slice(-5)}`;

  await page.goto("/pessoas/nova");
  await page.getByLabel("CPF").fill(cpf);
  await page.getByLabel("Nome completo").fill(nome);
  await page.getByRole("button", { name: "Cadastrar pessoa" }).click();
  await expect(page).toHaveURL(/\/pessoas\/[0-9a-f-]{36}/);

  const envio = {
    // Com máscara, como a entrada do cadastro do portal mostra.
    cpf: `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`,
    screenKey: "cadastro_dados",
    values: {
      "person.fullName": "NOME QUE ESTAVA NO PORTAL",
      "person.motherName": "MAE VINDA DO PORTAL",
    },
  };

  const primeira = await request.post("/api/ext/captura", { headers, data: envio });
  expect(primeira.status()).toBe(200);
  const corpo = (await primeira.json()) as { found: boolean; applied: string[] };
  expect(corpo.found).toBe(true);
  expect(corpo.applied).toEqual(["person.motherName"]);

  // O nome já existia e a mãe acabou de ser gravada: nada mais a aplicar.
  const segunda = await request.post("/api/ext/captura", { headers, data: envio });
  expect(((await segunda.json()) as { applied: string[] }).applied).toEqual([]);

  await page.reload();
  await expect(page.getByRole("heading", { name: nome })).toBeVisible();

  // Rendas da lista do portal: entram uma vez, e ler a lista de novo não duplica.
  const rendas = {
    cpf,
    screenKey: "renda_informal",
    values: {},
    incomes: [{ kind: "informal", sourceName: "CORRETOR", startDate: "2015-01-01", netCents: "1500,00" }],
  };
  const comRenda = await request.post("/api/ext/captura", { headers, data: rendas });
  expect(((await comRenda.json()) as { incomesAdded: number }).incomesAdded).toBe(1);
  const deNovo = await request.post("/api/ext/captura", { headers, data: rendas });
  expect(((await deNovo.json()) as { incomesAdded: number }).incomesAdded).toBe(0);

  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "CORRETOR" })).toHaveCount(1);
});

test("dependentes e despesas entram no grupo familiar, sem sobrescrever", async ({
  page,
  request,
}) => {
  const cpf = cpfFicticio();
  await page.goto("/pessoas/nova");
  await page.getByLabel("CPF").fill(cpf);
  await page.getByLabel("Nome completo").fill(`GRUPO FAMILIAR ${Date.now().toString().slice(-5)}`);
  await page.getByRole("button", { name: "Cadastrar pessoa" }).click();
  await expect(page).toHaveURL(/\/pessoas\/[0-9a-f-]{36}/);

  const enviar = (screenKey: string, values: Record<string, string>) =>
    request.post("/api/ext/captura", { headers, data: { cpf, screenKey, values, incomes: [] } });

  // Como a extensão manda depois de ler a tela: dinheiro em centavos.
  await enviar("dependentes", { "person.dependentsCount": "2" });
  const despesas = await enviar("despesas", {
    "person.rentCents": "150000",
    "person.condoFeeCents": "35050",
  });
  expect(((await despesas.json()) as { applied: string[] }).applied).toEqual([
    "person.rentCents",
    "person.condoFeeCents",
  ]);

  // Valor diferente no portal não troca o que o cadastro já tem.
  await enviar("despesas", { "person.rentCents": "999900" });

  await page.reload();
  await expect(page.getByLabel("Dependentes sem renda")).toHaveValue("2");
  await expect(page.getByLabel("Aluguel")).toHaveValue("1500,00");
  await expect(page.getByLabel("Condomínio")).toHaveValue("350,50");
  await expect(page.getByLabel("Pensão alimentícia")).toHaveValue("");

  // O formulário da web grava em reais e mostra de volta o mesmo valor.
  await page.getByLabel("Pensão alimentícia").fill("1.234,56");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.reload();
  await expect(page.getByLabel("Pensão alimentícia")).toHaveValue("1234,56");
  await expect(page.getByLabel("Aluguel")).toHaveValue("1500,00");
});

test("CPF sem cadastro não cria ninguém", async ({ request }) => {
  const resposta = await request.post("/api/ext/captura", {
    headers,
    data: { cpf: cpfFicticio(), screenKey: "cadastro_dados", values: { "person.fullName": "X" } },
  });
  expect(resposta.status()).toBe(200);
  expect(await resposta.json()).toEqual({ found: false, applied: [] });
});

test("sem CPF válido a captura é recusada", async ({ request }) => {
  const resposta = await request.post("/api/ext/captura", {
    headers,
    data: { cpf: "123", values: {} },
  });
  expect(resposta.status()).toBe(400);
});
