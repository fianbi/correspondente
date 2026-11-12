"use server";

import { PROCESS_STATUS_LABELS, formatCpf } from "@corr/core";
import { currentStepOf, listPeople, listProcesses, listSimulations } from "@corr/db";
import { requireOrgContext } from "@/server/session";

export interface ResultadoDaBusca {
  tipo: "processo" | "pessoa" | "simulacao";
  href: string;
  titulo: string;
  detalhe: string;
}

/**
 * Busca rápida (Ctrl+K): processo pelo número, nome ou CPF do cliente;
 * pessoa por nome, CPF ou celular; simulação pelo nome do cliente. Usa as
 * mesmas buscas das listagens, então acha exatamente o que elas achariam.
 */
export async function buscaRapida(termo: string): Promise<ResultadoDaBusca[]> {
  const search = termo.trim();
  if (search.length < 2) return [];
  const ctx = await requireOrgContext();

  const [processos, pessoas, simulacoes] = await Promise.all([
    listProcesses(ctx, { search, includeClosed: true }),
    listPeople(ctx, { search, limit: 6 }),
    listSimulations(ctx, { search }),
  ]);

  return [
    ...processos.slice(0, 6).map((p) => ({
      tipo: "processo" as const,
      href: `/processos/${p.id}`,
      titulo: `#${p.number} ${p.personName}`,
      detalhe: [currentStepOf(p).label, PROCESS_STATUS_LABELS[p.status]].join(" · "),
    })),
    ...pessoas.rows.map((p) => ({
      tipo: "pessoa" as const,
      href: `/pessoas/${p.id}`,
      titulo: p.fullName,
      detalhe: [formatCpf(p.cpf), p.phone].filter(Boolean).join(" · "),
    })),
    ...simulacoes.slice(0, 4).map((s) => ({
      tipo: "simulacao" as const,
      href: `/simulacoes/${s.id}`,
      titulo: s.clientName,
      detalhe: ["Simulação", s.clientPhone].filter(Boolean).join(" · "),
    })),
  ];
}
