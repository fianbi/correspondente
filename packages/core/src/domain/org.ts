import { z } from "zod";

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
 * Contexto de tenant exigido por todo repositório em `@corr/db`. Nenhuma query
 * de dados de escritório roda sem ele — é o que garante o isolamento na camada
 * de aplicação, antes mesmo da RLS.
 */
export interface OrgContext {
  orgId: string;
  userId: string;
  role: OrgRole;
}
