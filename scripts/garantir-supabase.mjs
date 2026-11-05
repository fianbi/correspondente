#!/usr/bin/env node
/**
 * Garante que o Supabase local está de pé antes do `pnpm dev`.
 *
 * Depois de um ou dois dias parado (máquina dormiu, Docker Desktop fechado ou
 * com o "Resource Saver" pausando a VM, containers parados) o login travava
 * ~25s e terminava em `AuthRetryableFetchError: fetch failed`. Este script:
 *
 *   1. testa a API do Supabase (rápido; se responde, sai na hora);
 *   2. se o Docker não responde, abre o Docker Desktop (Windows/macOS) e espera;
 *   3. roda `supabase start` (idempotente: só sobe o que estiver parado);
 *   4. espera a API responder de novo.
 *
 * Pular: `SKIP_SUPABASE_CHECK=1 pnpm dev` (ex.: apontando para um Supabase remoto).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const raiz = resolve(import.meta.dirname, "..");

if (process.env.SKIP_SUPABASE_CHECK === "1" || process.env.CI) process.exit(0);

function lerUrlSupabase() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return process.env.NEXT_PUBLIC_SUPABASE_URL;
  const arquivo = resolve(raiz, ".env.local");
  if (existsSync(arquivo)) {
    const linha = readFileSync(arquivo, "utf8")
      .split(/\r?\n/)
      .find((l) => l.trim().startsWith("NEXT_PUBLIC_SUPABASE_URL="));
    if (linha) return linha.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
  }
  return "http://127.0.0.1:54321";
}

const url = lerUrlSupabase();
const local = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(url);
if (!local) process.exit(0); // Supabase remoto: nada a subir aqui.

const log = (msg) => console.log(`[supabase] ${msg}`);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Qualquer resposta HTTP (até 401) conta como "de pé"; erro de rede ou timeout não. */
async function apiResponde(timeoutMs = 3000) {
  try {
    await fetch(`${url}/auth/v1/health`, { signal: AbortSignal.timeout(timeoutMs) });
    return true;
  } catch {
    return false;
  }
}

function dockerResponde() {
  const r = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], {
    stdio: "ignore",
    timeout: 15_000,
    shell: process.platform === "win32",
  });
  return r.status === 0;
}

function abrirDockerDesktop() {
  if (process.platform === "win32") {
    const exe = [
      process.env.ProgramFiles && resolve(process.env.ProgramFiles, "Docker/Docker/Docker Desktop.exe"),
      "C:/Program Files/Docker/Docker/Docker Desktop.exe",
    ].find((p) => p && existsSync(p));
    if (!exe) return false;
    spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
    return true;
  }
  if (process.platform === "darwin") {
    spawn("open", ["-a", "Docker"], { detached: true, stdio: "ignore" }).unref();
    return true;
  }
  return false; // Linux: o daemon costuma subir com o sistema.
}

async function esperar(cond, totalMs, passoMs = 2000) {
  const fim = Date.now() + totalMs;
  while (Date.now() < fim) {
    if (await cond()) return true;
    await dormir(passoMs);
  }
  return false;
}

function falhar(msg) {
  console.error(`\n[supabase] ${msg}\n`);
  process.exit(1);
}

if (await apiResponde()) process.exit(0);

log(`API em ${url} não respondeu; verificando o Docker…`);

if (!dockerResponde()) {
  if (!abrirDockerDesktop()) falhar("Docker não está rodando e não consegui abri-lo. Inicie o Docker e rode `pnpm dev` de novo.");
  log("Abrindo o Docker Desktop e esperando o daemon (até 3 min)…");
  if (!(await esperar(async () => dockerResponde(), 180_000, 3000))) {
    falhar("O Docker Desktop não respondeu em 3 minutos.");
  }
  log("Docker de pé.");
}

// `supabase start` considera a stack "já rodando" se o banco está de pé e não
// religa os containers que caíram sozinhos (ex.: só o Kong parado deixa a API
// fora do ar). Religa primeiro os containers parados deste projeto.
const projeto =
  readFileSync(resolve(raiz, "supabase/config.toml"), "utf8").match(/^project_id\s*=\s*"([^"]+)"/m)?.[1] ??
  "correspondente";
const parados = spawnSync(
  "docker",
  ["ps", "-a", "-q", "--filter", `label=com.supabase.cli.project=${projeto}`, "--filter", "status=exited"],
  { encoding: "utf8", timeout: 15_000, shell: process.platform === "win32" },
)
  .stdout?.split(/\s+/)
  .filter(Boolean);
if (parados?.length) {
  log(`Religando ${parados.length} container(s) parado(s)…`);
  for (const id of parados) {
    spawnSync("docker", ["start", id], { stdio: "ignore", timeout: 60_000, shell: process.platform === "win32" });
  }
  if (await esperar(() => apiResponde(), 30_000)) {
    log("Supabase local de pé.");
    process.exit(0);
  }
}

log("Rodando `supabase start`…");
const start = spawnSync("pnpm", ["exec", "supabase", "start"], {
  cwd: raiz,
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (start.status !== 0) falhar("`supabase start` falhou (veja a saída acima).");

if (!(await esperar(() => apiResponde(), 60_000))) {
  falhar(`O Supabase subiu mas a API em ${url} não respondeu em 1 minuto.`);
}
log("Supabase local de pé.");
