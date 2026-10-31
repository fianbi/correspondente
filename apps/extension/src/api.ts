import type { FormularioEnviado, PortalProfile, SavedIncome } from "@corr/portal";

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

/** Cliente da lista do painel: os atualizados por último vêm primeiro. */
export interface ClienteResumo {
  id: string;
  cpf: string;
  fullName: string;
  city: string | null;
  uf: string | null;
  updatedAt: string;
}

export interface RendaDoCliente {
  id: string;
  label: string;
  kind: "formal" | "informal";
  values: Record<string, string | null>;
}

export interface PessoaDaTela {
  id: string;
  cpf: string;
  fullName: string;
  birthDate: string | null;
  motherName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  uf: string | null;
  maritalStatus: string | null;
  spouseName: string | null;
  dependentsCount: number | null;
  rentCents: number | null;
  condoFeeCents: number | null;
  alimonyCents: number | null;
  relationshipAgencyNumber: string | null;
  relationshipAgencyCity: string | null;
  relationshipAgencyUf: string | null;
  incomes: {
    kind: string;
    sourceName: string | null;
    grossCents: number | null;
    netCents: number | null;
  }[];
  processes: { id: string; number: number; stage: string; status: string }[];
  /** Avaliações de risco do SICAQ, mais recentes primeiro. */
  riskAssessments?: {
    proposalNumber: string;
    result: string | null;
    validUntil: string | null;
    product?: string | null;
    /** Habitação é a que vale para o processo; CROT e cartão são extras. */
    housing?: boolean;
  }[];
}

/** O que o botão de preencher escreve no portal, já nos códigos do banco. */
export interface DadosDoCliente {
  personId: string;
  personName: string;
  values: Record<string, string | null>;
  incomes: RendaDoCliente[];
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

  clientes: (config: Config, busca: string) =>
    chamar<ClienteResumo[]>(config, `/pessoas?q=${encodeURIComponent(busca)}`),

  dadosDoCliente: (config: Config, cpf: string) =>
    chamar<DadosDoCliente>(config, `/pessoas/${cpf}/dados`),

  /**
   * Leva o que está na tela para o cadastro do CPF: a captura automática e o
   * botão "Trazer da tela" usam o mesmo caminho.
   */
  capturarPorCpf: (
    config: Config,
    envio: {
      cpf: string;
      screenKey: string;
      values: Record<string, string>;
      incomes: SavedIncome[];
    },
  ) =>
    chamar<{
      found: boolean;
      applied: string[];
      incomesAdded?: number;
      incomesUpdated?: number;
      created?: boolean;
      spouseCreated?: boolean;
      ignored?: string[];
    }>(config, "/captura", {
      method: "POST",
      body: JSON.stringify(envio),
    }),

  /** Linhas com avaliação de risco da tela "Formulários Enviados". */
  avaliacoesDeRisco: (config: Config, envio: { cpf: string; rows: FormularioEnviado[] }) =>
    chamar<{
      found: boolean;
      added: number;
      updated: number;
      linkedProcesses: number[];
    }>(config, "/avaliacoes-risco", {
      method: "POST",
      body: JSON.stringify(envio),
    }),

  /** Cadastro do CPF que está na tela do portal; `null` se ainda não existe. */
  pessoaPorCpf: (config: Config, cpf: string) =>
    chamar<PessoaDaTela | null>(config, `/pessoas/${cpf}`),

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
