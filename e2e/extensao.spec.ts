import { expect, test } from "@playwright/test";

/**
 * Exercita a API que a extensão consome, do jeito que ela consome: com o
 * cookie da sessão da web (o `request` já vem com o do storageState) e a origem
 * da extensão. A extensão não tem login próprio.
 */

const EMAIL = process.env.SEED_USER_EMAIL ?? "dev@correspondente.local";
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "dev12345678";

const ORIGEM_EXTENSAO = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";

const headers = { origin: ORIGEM_EXTENSAO, "content-type": "application/json" };

test("sessão da web identifica usuário e escritório", async ({ request }) => {
  const resposta = await request.get("/api/ext/sessao", { headers });
  expect(resposta.status()).toBe(200);
  expect(await resposta.json()).toMatchObject({ email: EMAIL, orgName: "Escritório Demo" });

  // A resposta libera a origem da extensão — e só ela —, com credenciais.
  expect(resposta.headers()["access-control-allow-origin"]).toBe(ORIGEM_EXTENSAO);
  expect(resposta.headers()["access-control-allow-credentials"]).toBe("true");
});

test("sem a sessão da web a API não responde nada", async ({ playwright, baseURL }) => {
  const semCookie = await playwright.request.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });

  const resposta = await semCookie.get("/api/ext/sessao", { headers });
  // 401, e não o redirecionamento para /login que a web faria.
  expect(resposta.status()).toBe(401);

  await semCookie.dispose();
});

test("site comum não usa o cookie da web contra a API", async ({ request }) => {
  const resposta = await request.get("/api/ext/sessao", {
    headers: { origin: "https://site-qualquer.com" },
  });

  expect(resposta.status()).toBe(401);
  expect(resposta.headers()["access-control-allow-origin"]).toBe("null");
});

test("lista processos e entrega os dados já em código de portal", async ({ request }) => {

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

test("busca por CPF encontra o processo", async ({ request }) => {

  const resposta = await request.get("/api/ext/processos?q=11144477735", { headers });
  const processos = (await resposta.json()) as { personCpf: string }[];

  expect(processos.length).toBeGreaterThan(0);
  expect(processos.every((p) => p.personCpf === "11144477735")).toBe(true);
});

test("o perfil do portal vem com as telas mapeadas", async ({ request }) => {

  const resposta = await request.get("/api/ext/perfis", { headers });
  const perfil = (await resposta.json()) as {
    key: string;
    screens: { key: string; mappings: unknown[] }[];
  };

  expect(perfil.key).toBe("caixa_aqui");
  const dados = perfil.screens.find((tela) => tela.key === "cadastro_dados");
  expect(dados?.mappings.length).toBeGreaterThan(15);
});

test("captura manual não regrava o que já está igual", async ({ request }) => {
  const lista = await request.get("/api/ext/processos", { headers });
  const [processo] = (await lista.json()) as { id: string }[];

  const antes = await request.get(`/api/ext/processos/${processo!.id}/dados`, { headers });
  const { values } = (await antes.json()) as { values: Record<string, string | null> };

  // A tela mostra o mesmo nome que o cadastro: nada a gravar. (A atualização
  // de verdade é testada em captura-auto.spec, com pessoas criadas no teste:
  // aqui a pessoa é do seed, e mudá-la sujaria a base dos outros testes.)
  const resposta = await request.post(`/api/ext/processos/${processo!.id}/captura`, {
    headers,
    data: { values: { "person.fullName": values["person.fullName"] } },
  });
  expect(((await resposta.json()) as { applied: string[] }).applied).toEqual([]);
});

test("sair na web desconecta a extensão", async ({ browser }) => {
  // Contexto próprio, com login próprio: sair aqui não derruba a sessão
  // compartilhada dos outros testes (o logout da web é `local`).
  const contexto = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await contexto.newPage();

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/painel");

  const sessao = () => contexto.request.get("/api/ext/sessao", { headers });
  expect((await sessao()).status()).toBe(200);

  await contexto.request.post("/auth/sair");
  expect((await sessao()).status()).toBe(401);

  await contexto.close();
});
