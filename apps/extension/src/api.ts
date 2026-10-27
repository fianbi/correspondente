import type { PortalProfile, SavedIncome } from "@corr/portal";

/**
 * Cliente da API do sistema.
 *
 * A extensão não tem login próprio: usa a sessão da web no mesmo navegador.
 * Com permissão de host para o endereço do sistema, o Chrome manda o cookie de
 * sessão junto (`credentials: "include"`). Usuário e escritório são sempre os
 * da web; trocar ou sair é lá.
 */

export interface Config {
  baseUrl: string;
}

export const ENDERECO_PADRAO = "http://localhost:3000";

export interface Sessao {
  email: string;
  orgId: string;
  orgName: string;
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

/** Sem sessão na web (ou ela foi encerrada): o painel pede para entrar no sistema. */
export class SessaoExpirada extends Error {
  constructor() {
    super("Você não está conectado ao sistema.");
  }
}

export async function lerConfig(): Promise<Config> {
  const guardado = (await chrome.storage.local.get(CONFIG_KEY))[CONFIG_KEY] as
    | Partial<Config>
    | undefined;
  return { baseUrl: guardado?.baseUrl ?? ENDERECO_PADRAO };
}

export async function gravarConfig(config: Config): Promise<void> {
  await chrome.storage.local.set({ [CONFIG_KEY]: { baseUrl: semBarra(config.baseUrl) } });
}

function semBarra(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, "");
}

async function chamar<T>(config: Config, caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${semBarra(config.baseUrl)}/api/ext${caminho}`, {
    ...init,
    credentials: "include",
    headers: { ...init?.headers, "content-type": "application/json" },
  }).catch(() => null);
  if (!resposta) throw new Error("Não foi possível falar com o sistema nesse endereço.");

  if (resposta.status === 401) throw new SessaoExpirada();
  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => null)) as { error?: string } | null;
    throw new Error(corpo?.error ?? `Falha na chamada (${resposta.status}).`);
  }

  return (await resposta.json()) as T;
}

export const api = {
  sessao: (config: Config) => chamar<Sessao>(config, "/sessao"),

  processos: (config: Config, busca: string) =>
    chamar<ProcessoResumo[]>(config, `/processos?q=${encodeURIComponent(busca)}`),

  dados: (config: Config, processId: string) =>
    chamar<DadosDoProcesso>(config, `/processos/${processId}/dados`),

  capturar: (config: Config, processId: string, values: Record<string, string | null>) =>
    chamar<{ applied: string[] }>(config, `/processos/${processId}/captura`, {
      method: "POST",
      body: JSON.stringify({ values }),
    }),

  /** Captura automática: a pessoa é achada pelo CPF, sem processo escolhido. */
  capturarPorCpf: (
    config: Config,
    envio: {
      cpf: string;
      screenKey: string;
      values: Record<string, string>;
      incomes: SavedIncome[];
    },
  ) =>
    chamar<{ found: boolean; applied: string[]; incomesAdded?: number }>(config, "/captura", {
      method: "POST",
      body: JSON.stringify(envio),
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
