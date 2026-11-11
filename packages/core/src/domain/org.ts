import { z } from "zod";
import { ForbiddenError } from "./errors";

/**
 * Papéis dentro de um escritório. A ordem importa: `rankOf` usa o índice para
 * comparar poder, então papéis novos entram na posição certa da lista.
 */
export const ORG_ROLES = ["operacional", "analista", "admin", "owner"] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

export const orgRoleSchema = z.enum(ORG_ROLES);

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  operacional: "Operacional",
  analista: "Analista",
  admin: "Administrador",
  owner: "Proprietário",
};

const rankOf = (role: OrgRole): number => ORG_ROLES.indexOf(role);

/** `true` se `role` tem pelo menos o poder de `minimum`. */
export function roleAtLeast(role: OrgRole, minimum: OrgRole): boolean {
  return rankOf(role) >= rankOf(minimum);
}

/**
 * O que cada papel pode fazer além do dia a dia (cadastrar, abrir processo,
 * mover etapa, enviar documento, gerar link e PDF, que todo papel faz).
 * O valor é o papel mínimo. Quem confere é o servidor; a tela só esconde o
 * botão de quem não pode.
 */
export const PERMISSOES = {
  excluir_processo: "admin",
  excluir_pessoa: "admin",
  excluir_documento: "analista",
  gerenciar_formularios: "admin",
  gerenciar_escritorio: "admin",
  gerenciar_equipe: "admin",
} as const satisfies Record<string, OrgRole>;

export type Permissao = keyof typeof PERMISSOES;

export function pode(role: OrgRole, permissao: Permissao): boolean {
  return roleAtLeast(role, PERMISSOES[permissao]);
}

export const MENSAGEM_SEM_PERMISSAO: Record<Permissao, string> = {
  excluir_processo: "Só administradores excluem processos.",
  excluir_pessoa: "Só administradores excluem cadastros de pessoas.",
  excluir_documento: "Seu papel não permite excluir documentos.",
  gerenciar_formularios: "Só administradores mexem nos modelos de formulário.",
  gerenciar_escritorio: "Só administradores podem alterar os dados do escritório.",
  gerenciar_equipe: "Só administradores mexem na equipe.",
};

/** Barra a ação de quem não tem a permissão. Chamado no servidor. */
export function exigirPermissao(ctx: { role: OrgRole }, permissao: Permissao): void {
  if (!pode(ctx.role, permissao)) throw new ForbiddenError(MENSAGEM_SEM_PERMISSAO[permissao]);
}

/**
 * Contexto de tenant exigido por todo repositório em `@corr/db`. Nenhuma query
 * de dados de escritório roda sem ele — é o que garante o isolamento na camada
 * de aplicação, antes mesmo da RLS.
 */
export interface OrgContext {
  orgId: string;
  userId: string;
  role: OrgRole;
}
