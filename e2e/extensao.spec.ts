import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Exercita a API que a extensão consome, do jeito que ela consome: token no
 * cabeçalho, origem de extensão, sem cookie nenhum.
 */

async function gerarToken(page: Page): Promise<{ token: string; label: string }> {
  // Rótulo único por execução: a base de desenvolvimento acumula tokens, e
  // revogar "o primeiro que contém Teste" acabaria pegando outro.
  const label = `Teste ${randomUUID().slice(0, 8)}`;

  await page.goto("/configuracoes/escritorio");
  await page.getByLabel("Identificação").fill(label);
  await page.getByRole("button", { name: "Gerar token" }).click();

  const codigo = page.locator("code").first();
  await expect(codigo).toBeVisible();
  const token = (await codigo.innerText()).trim();
  expect(token.startsWith("corr_")).toBe(true);
  return { token, label };
}

const ORIGEM_EXTENSAO = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";

function comToken(request: APIRequestContext, token: string) {
  return {
    headers: {
      authorization: `Bearer ${token}`,
      origin: ORIGEM_EXTENSAO,
      "content-type": "application/json",
    },
    request,
  };
}

test("token válido identifica o escritório", async ({ page, request }) => {
  const { token } = await gerarToken(page);
  const { headers } = comToken(request, token);

  const resposta = await request.get("/api/ext/sessao", { headers });
  expect(resposta.status()).toBe(200);
  expect(await resposta.json()).toMatchObject({ orgName: "Escritório Demo" });

  // A resposta libera a origem da extensão — e só ela.
  expect(resposta.headers()["access-control-allow-origin"]).toBe(ORIGEM_EXTENSAO);
});

test("sem token a API não responde nada", async ({ request }) => {
  const semNada = await request.get("/api/ext/sessao");
  expect(semNada.status()).toBe(401);

  const inventado = await request.get("/api/ext/sessao", {
    headers: { authorization: "Bearer corr_token_inventado_qualquer" },
  });
  expect(inventado.status()).toBe(401);
});

test("origem de site comum não é liberada pelo CORS", async ({ page, request }) => {
  const { token } = await gerarToken(page);

  const resposta = await request.get("/api/ext/sessao", {
    headers: { authorization: `Bearer ${token}`, origin: "https://site-qualquer.com" },
  });

  // O token ainda funciona (é cabeçalho, não cookie), mas o navegador de um
  // site comum não conseguiria ler a resposta.
  expect(resposta.headers()["access-control-allow-origin"]).toBe("null");
});

test("lista processos e entrega os dados já em código de portal", async ({ page, request }) => {
  const { token } = await gerarToken(page);
  const { headers } = comToken(request, token);

  const lista = await request.get("/api/ext/processos", { headers });
  const processos = (await lista.json()) as { id: string; number: number }[];
  expect(processos.length).toBeGreaterThan(0);

  const dados = await request.get(`/api/ext/processos/${processos[0]!.id}/dados`, { headers });
  const corpo = (await dados.json()) as { values: Record<string, string | null> };

  expect(corpo.values["person.cpf"]).toMatch(/^\d{11}$/);
  // Domínio traduzido para o código que o SICAQ espera, não o rótulo.
  if (corpo.values["person.maritalStatus"]) {
    expect(corpo.values["person.maritalStatus"]).toMatch(/^\d$/);
  }
});

test("busca por CPF encontra o processo", async ({ page, request }) => {
  const { token } = await gerarToken(page);
  const { headers } = comToken(request, token);

  const resposta = await request.get("/api/ext/processos?q=11144477735", { headers });
  const processos = (await resposta.json()) as { personCpf: string }[];

  expect(processos.length).toBeGreaterThan(0);
  expect(processos.every((p) => p.personCpf === "11144477735")).toBe(true);
});

test("o perfil do portal vem com as telas mapeadas", async ({ page, request }) => {
  const { token } = await gerarToken(page);
  const { headers } = comToken(request, token);

  const resposta = await request.get("/api/ext/perfis", { headers });
  const perfil = (await resposta.json()) as {
    key: string;
    screens: { key: string; mappings: unknown[] }[];
  };

  expect(perfil.key).toBe("caixa_aqui");
  const dados = perfil.screens.find((tela) => tela.key === "cadastro_dados");
  expect(dados?.mappings.length).toBeGreaterThan(15);
});

test("captura não sobrescreve o que o cadastro já tem", async ({ page, request }) => {
  const { token } = await gerarToken(page);
  const { headers } = comToken(request, token);

  const lista = await request.get("/api/ext/processos", { headers });
  const [processo] = (await lista.json()) as { id: string }[];

  // A pessoa do seed já tem nome: a captura não pode trocá-lo pelo que estiver
  // na tela do banco, senão desfaz conferência humana em silêncio.
  const resposta = await request.post(`/api/ext/processos/${processo!.id}/captura`, {
    headers,
    data: { values: { "person.fullName": "NOME VINDO DO PORTAL", "person.pis": "12345678901" } },
  });

  const corpo = (await resposta.json()) as { applied: string[] };
  expect(corpo.applied).not.toContain("person.fullName");

  const dados = await request.get(`/api/ext/processos/${processo!.id}/dados`, { headers });
  const valores = (await dados.json()) as { values: Record<string, string | null> };
  expect(valores.values["person.fullName"]).not.toBe("NOME VINDO DO PORTAL");
});

test("token revogado para de funcionar na hora", async ({ page, request }) => {
  const { token, label } = await gerarToken(page);
  const { headers } = comToken(request, token);

  expect((await request.get("/api/ext/sessao", { headers })).status()).toBe(200);

  await page.reload();
  const linha = page.getByRole("listitem").filter({ hasText: label });
  await linha.getByRole("button", { name: "Revogar" }).click();
  await expect(linha.getByText("Revogado")).toBeVisible();

  expect((await request.get("/api/ext/sessao", { headers })).status()).toBe(401);
});
