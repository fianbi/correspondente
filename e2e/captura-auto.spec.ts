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

test("CPF novo com nome vira cadastro, com o cônjuge", async ({ request }) => {
  const cpf = cpfFicticio();
  const conjuge = cpfFicticio();
  const sufixo = Date.now().toString().slice(-5);

  const resposta = await request.post("/api/ext/captura", {
    headers,
    data: {
      cpf,
      screenKey: "cadastro_dados",
      values: {
        "person.fullName": `CLIENTE NOVO ${sufixo}`,
        "person.motherName": "MAE DO CLIENTE NOVO",
        "person.spouseCpf": conjuge,
        "person.spouseName": `CONJUGE NOVO ${sufixo}`,
        // Formato que o cadastro não aceita: fica de fora, sem levar o resto.
        "person.email": "nao-e-email",
      },
      incomes: [],
    },
  });
  expect(resposta.status()).toBe(200);
  expect(await resposta.json()).toMatchObject({
    found: true,
    created: true,
    spouseCreated: true,
    applied: expect.arrayContaining(["person.fullName", "person.motherName"]),
    ignored: ["person.email"],
  });

  // O painel acha os dois pelo CPF.
  const pessoa = await request.get(`/api/ext/pessoas/${cpf}`, { headers });
  expect(await pessoa.json()).toMatchObject({
    fullName: `CLIENTE NOVO ${sufixo}`,
    motherName: "MAE DO CLIENTE NOVO",
    spouseName: `CONJUGE NOVO ${sufixo}`,
    processes: [],
  });
  const doConjuge = await request.get(`/api/ext/pessoas/${conjuge}`, { headers });
  expect(await doConjuge.json()).toMatchObject({ fullName: `CONJUGE NOVO ${sufixo}` });

  // A mesma tela de novo não cria nada outra vez.
  const deNovo = await request.post("/api/ext/captura", {
    headers,
    data: { cpf, screenKey: "cadastro_dados", values: { "person.fullName": "OUTRO NOME" }, incomes: [] },
  });
  expect(await deNovo.json()).toMatchObject({ found: true, created: false, applied: [] });
});

test("listas da tela aparecem preenchidas no cadastro da web", async ({ page, request }) => {
  const cpf = cpfFicticio();
  const resposta = await request.post("/api/ext/captura", {
    headers,
    data: {
      cpf,
      screenKey: "cadastro_dados",
      // Como a extensão manda depois de traduzir os códigos do portal.
      values: {
        "person.fullName": `CLIENTE LISTAS ${Date.now().toString().slice(-5)}`,
        "person.sex": "feminino",
        "person.nationality": "brasileiro",
        "person.birthUf": "SP",
        "person.birthCity": "ADAMANTINA",
        "person.educationLevel": "medio_completo",
        // Casado sem o cônjuge ainda: o nome dele vem depois, e o estado
        // civil não pode ficar de fora por isso.
        "person.maritalStatus": "casado_comunhao_parcial",
        "person.docType": "rg",
        "person.docIssuer": "SECRETARIA DE SEGURANÇA PÚBLICA",
        "person.docIssuerUf": "SP",
      },
      incomes: [],
    },
  });
  const corpo = (await resposta.json()) as { personId: string; ignored: string[] };
  expect(corpo.ignored).toEqual([]);

  await page.goto(`/pessoas/${corpo.personId}`);
  await expect(page.getByLabel("Sexo")).toHaveValue("feminino");
  await expect(page.getByLabel("Nacionalidade")).toHaveValue("brasileiro");
  await expect(page.getByLabel("UF de naturalidade")).toHaveValue("SP");
  await expect(page.getByLabel("Cidade de naturalidade")).toHaveValue("ADAMANTINA");
  await expect(page.getByLabel("Grau de instrução")).toHaveValue("medio_completo");
  await expect(page.getByLabel("Estado civil")).toHaveValue("casado_comunhao_parcial");
  await expect(page.getByLabel("Órgão emissor")).toHaveValue("SECRETARIA DE SEGURANÇA PÚBLICA");
  await expect(page.getByLabel("UF do órgão")).toHaveValue("SP");
});

test("declaração de propósitos e agência de relacionamento aparecem no cadastro", async ({
  page,
  request,
}) => {
  const cpf = cpfFicticio();
  const enviar = (screenKey: string, values: Record<string, string>) =>
    request.post("/api/ext/captura", { headers, data: { cpf, screenKey, values, incomes: [] } });

  const criada = await enviar("cadastro_dados", {
    "person.fullName": `CLIENTE PROPOSITOS ${Date.now().toString().slice(-5)}`,
    "person.purposeAccounts": "true",
    "person.purposeLoans": "true",
    "person.purposeHousingLoan": "true",
    "person.purposeInvestments": "false",
  });
  const { personId } = (await criada.json()) as { personId: string };
  await enviar("agencia_relacionamento", {
    "person.relationshipAgencyUf": "SP",
    "person.relationshipAgencyCity": "ADAMANTINA",
    "person.relationshipAgencyNumber": "2352",
  });

  await page.goto(`/pessoas/${personId}`);
  await expect(page.getByLabel("Movimentação de conta, depósito e poupança")).toHaveValue("true");
  await expect(page.getByLabel("Financiamento habitacional")).toHaveValue("true");
  await expect(page.getByLabel("Investimentos")).toHaveValue("false");
  // Não respondido continua em branco, e não vira "não".
  await expect(page.getByLabel("Cartão de crédito")).toHaveValue("");
  await expect(page.getByLabel("Agência", { exact: true })).toHaveValue("2352");
  await expect(page.getByLabel("Município da agência")).toHaveValue("ADAMANTINA");
  await expect(page.getByLabel("UF da agência")).toHaveValue("SP");
});

test("CPF novo sem nome na tela não cria ninguém", async ({ request }) => {
  const cpf = cpfFicticio();
  const resposta = await request.post("/api/ext/captura", {
    headers,
    data: { cpf, screenKey: "cadastro_endereco", values: { "person.zipCode": "01310100" } },
  });
  expect(await resposta.json()).toEqual({ found: false, applied: [] });
  expect(await (await request.get(`/api/ext/pessoas/${cpf}`, { headers })).json()).toBeNull();
});

test("sem CPF válido a captura é recusada", async ({ request }) => {
  const resposta = await request.post("/api/ext/captura", {
    headers,
    data: { cpf: "123", values: {} },
  });
  expect(resposta.status()).toBe(400);
});
