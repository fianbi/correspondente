import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect, test, type BrowserContext, type Worker } from "@playwright/test";
import { STORAGE_STATE } from "./paths";

/**
 * A extensão de verdade, carregada no Chromium: o content script lê as telas
 * do portal (servidas a partir das fixtures, no endereço do Caixa), e o
 * background manda para o sistema com o cookie da sessão da web.
 *
 * É o caminho inteiro da captura automática: CPF digitado na entrada do
 * cadastro, tela seguinte sem CPF, envio na saída da página.
 */

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSAO = resolve(raiz, "apps/extension/.output/chrome-mv3");
const PORTAL = "https://caixaaqui.caixa.gov.br/caixaaqui/CaixaAquiController";

function fixture(nome: string): string {
  return readFileSync(resolve(raiz, "fixtures/caixa", nome), "utf8");
}

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

interface Ultima {
  em: number;
  screenKey: string;
  cpfFinal: string;
  applied: string[];
  erro: string | null;
}

const ultima = (): Promise<Ultima | undefined> =>
  fundo.evaluate(async () => {
    const guardado = await chrome.storage.local.get("corr.capturaAuto.ultima");
    return guardado["corr.capturaAuto.ultima"] as Ultima | undefined;
  });

let contexto: BrowserContext;
let fundo: Worker;
let pasta: string;

test.beforeAll(async () => {
  execSync("pnpm --filter @corr/extension build", { cwd: raiz, stdio: "ignore" });

  pasta = mkdtempSync(join(tmpdir(), "corr-ext-"));
  contexto = await chromium.launchPersistentContext(pasta, {
    channel: "chromium",
    args: [`--disable-extensions-except=${EXTENSAO}`, `--load-extension=${EXTENSAO}`],
  });

  const estado = JSON.parse(readFileSync(STORAGE_STATE, "utf8")) as {
    cookies: Parameters<BrowserContext["addCookies"]>[0];
  };
  await contexto.addCookies(estado.cookies);

  fundo = contexto.serviceWorkers()[0] ?? (await contexto.waitForEvent("serviceworker"));

  // O portal vem das fixtures; o resto da internet fica de fora.
  await contexto.route("https://**/*", (rota) => {
    const url = new URL(rota.request().url());
    if (url.hostname !== "caixaaqui.caixa.gov.br") return rota.abort();
    // Caminhos reais do portal: a URL é o que diz se a aba saiu do cadastro.
    if (url.pathname.endsWith("/cadastro_cliente")) {
      return rota.fulfill({ contentType: "text/html", body: fixture("cadastro-de-clientes-1.html") });
    }
    if (url.pathname.endsWith("/st_cadastro_cliente1_consulta_cpf")) {
      return rota.fulfill({ contentType: "text/html", body: fixture("cadastro-de-clientes-3.html") });
    }
    if (url.pathname.endsWith("/cadastro_cliente12b_renda_dependentes_finalizar")) {
      return rota.fulfill({ contentType: "text/html", body: fixture("cadastro-de-clientes-8.html") });
    }
    if (url.pathname.endsWith("/cadastro_cliente4")) {
      return rota.fulfill({ contentType: "text/html", body: fixture("cadastro-de-clientes-6.html") });
    }
    return rota.fulfill({ contentType: "text/html", body: "<p>fim</p>" });
  });
});

test.afterAll(async () => {
  await contexto?.close();
  rmSync(pasta, { recursive: true, force: true });
});

test("tela salva no portal completa o cadastro do CPF digitado na entrada", async () => {
  const pagina = await contexto.newPage();

  const cpf = cpfFicticio();
  const nome = `EXTENSAO CAPTURA ${Date.now().toString().slice(-5)}`;
  await pagina.goto("http://localhost:3000/pessoas/nova");
  await pagina.getByLabel("CPF").fill(cpf);
  await pagina.getByLabel("Nome completo").fill(nome);
  await pagina.getByRole("button", { name: "Cadastrar pessoa" }).click();
  await expect(pagina).toHaveURL(/\/pessoas\/[0-9a-f-]{36}/);

  // Entrada do cadastro: o operador digita o CPF e consulta.
  await pagina.goto(`${PORTAL}/cadastro_cliente`);
  await pagina.locator("#cpf").fill(`${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`);
  await pagina.goto(`${PORTAL}/cadastro_cliente/st_cadastro_cliente1_consulta_cpf`);

  // Dados cadastrais: a tela não mostra o CPF; vale o da entrada.
  await pagina.locator('[name="nomeCompleto"]').fill("NOME QUE ESTAVA NO PORTAL");
  await pagina.locator('[name="nomeMae"]').fill("MAE VINDA DO PORTAL");
  await pagina.goto(`${PORTAL}/cadastro_cliente/cadastro_cliente_1_validar`);

  await expect.poll(ultima, { timeout: 10_000 }).toMatchObject({
    screenKey: "cadastro_dados",
    cpfFinal: cpf.slice(-4),
    // O nome já existia no sistema: só a mãe, que estava vazia, entra.
    applied: ["person.motherName"],
    erro: null,
  });

  // Renda informal: a tela não mostra o CPF, e a renda vem da lista já salva.
  await pagina.goto(`${PORTAL}/cadastro_cliente/cadastro_cliente4`);
  await pagina.goto(`${PORTAL}/cadastro_cliente/cadastro_cliente5`);
  await expect.poll(ultima, { timeout: 10_000 }).toMatchObject({
    screenKey: "renda_informal",
    incomesAdded: 1,
    erro: null,
  });

  // Despesas: digitadas no formato do portal, chegam em centavos no cadastro.
  await pagina.goto(`${PORTAL}/cadastro_cliente/cadastro_cliente12b_renda_dependentes_finalizar`);
  await pagina.locator('[name="iAluguel"]').fill("1.500,00");
  await pagina.goto(`${PORTAL}/cadastro_cliente/cadastro_cliente12b_renda_dependentes_avancar`);
  await expect.poll(ultima, { timeout: 10_000 }).toMatchObject({
    screenKey: "despesas",
    applied: ["person.rentCents"],
    erro: null,
  });
});

test("sair do cadastro esquece o CPF: a tela seguinte não vai para ninguém", async () => {
  const pagina = await contexto.newPage();
  const antes = await ultima();

  await pagina.goto(`${PORTAL}/cadastro_cliente`);
  await pagina.locator("#cpf").fill("11144477735");
  await pagina.goto(`${PORTAL}/menu_negocios`);

  // Outro cliente aberto direto na tela de dados, sem passar pela entrada.
  await pagina.goto(`${PORTAL}/cadastro_cliente/st_cadastro_cliente1_consulta_cpf`);
  await pagina.locator('[name="nomeMae"]').fill("MAE DE OUTRO CLIENTE");
  await pagina.goto(`${PORTAL}/cadastro_cliente/cadastro_cliente_1_validar`);

  // Dá tempo ao background; nada pode ter sido enviado.
  await pagina.waitForTimeout(1500);
  expect((await ultima())?.em).toBe(antes?.em);
});
