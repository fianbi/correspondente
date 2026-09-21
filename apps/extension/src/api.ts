import type { PortalProfile } from "@corr/portal";

/**
 * Cliente da API do sistema.
 *
 * Autentica por token (gerado nas configurações do escritório), não por
 * cookie: a extensão roda em outra origem e não receberia o cookie de sessão.
 */

export interface Config {
  baseUrl: string;
  token: string;
}

export interface ProcessoResumo {
  id: string;
  number: number;
  personName: string;
  personCpf: string;
  stage: string;
  status: string;
}

export interface RendaDoProcesso {
  id: string;
  label: string;
  kind: "formal" | "informal";
  values: Record<string, string | null>;
}

export interface DadosDoProcesso {
  processId: string;
  number: number;
  personName: string;
  values: Record<string, string | null>;
  incomes: RendaDoProcesso[];
}

const CONFIG_KEY = "corr.config";

export async function lerConfig(): Promise<Config | null> {
  const guardado = await chrome.storage.local.get(CONFIG_KEY);
  return (guardado[CONFIG_KEY] as Config | undefined) ?? null;
}

export async function gravarConfig(config: Config): Promise<void> {
  await chrome.storage.local.set({ [CONFIG_KEY]: config });
}

export async function limparConfig(): Promise<void> {
  await chrome.storage.local.remove(CONFIG_KEY);
}

async function chamar<T>(config: Config, caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${config.baseUrl.replace(/\/$/, "")}/api/ext${caminho}`, {
    ...init,
    headers: {
      ...init?.headers,
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
  });

  if (resposta.status === 401) throw new Error("Token inválido ou revogado.");
  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => null)) as { error?: string } | null;
    throw new Error(corpo?.error ?? `Falha na chamada (${resposta.status}).`);
  }

  return (await resposta.json()) as T;
}

export const api = {
  sessao: (config: Config) => chamar<{ orgId: string; orgName: string }>(config, "/sessao"),

  processos: (config: Config, busca: string) =>
    chamar<ProcessoResumo[]>(config, `/processos?q=${encodeURIComponent(busca)}`),

  dados: (config: Config, processId: string) =>
    chamar<DadosDoProcesso>(config, `/processos/${processId}/dados`),

  capturar: (config: Config, processId: string, values: Record<string, string | null>) =>
    chamar<{ applied: string[] }>(config, `/processos/${processId}/captura`, {
      method: "POST",
      body: JSON.stringify({ values }),
    }),

  perfil: (config: Config) => chamar<PortalProfile>(config, "/perfis"),

  ensinar: (
    config: Config,
    mapping: { screenKey: string; dataKey: string; selector: string; transform?: string | null },
  ) =>
    chamar<{ ok: true }>(config, "/perfis", {
      method: "POST",
      body: JSON.stringify(mapping),
    }),
};
