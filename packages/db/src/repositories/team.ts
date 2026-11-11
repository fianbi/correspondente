import { createHash, randomBytes } from "node:crypto";
import {
  type OrgContext,
  type OrgRole,
  DomainError,
  ForbiddenError,
  NotFoundError,
  exigirPermissao,
} from "@corr/core";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { getAdminDb, withOrg, type Tx } from "../client";
import { orgInvites, orgMembers, orgs, profiles } from "../schema/orgs";

/**
 * Equipe do escritório: convites, papel de cada um e saída.
 *
 * Regras que valem para tudo aqui: só quem tem `gerenciar_equipe` (Admin ou
 * Proprietário) mexe na equipe; só o Proprietário cria, muda ou tira outro
 * Proprietário; o escritório nunca fica sem Proprietário; ninguém muda o
 * próprio papel nem se tira (para não ficar trancado do lado de fora).
 */

const VALIDADE_DO_CONVITE_DIAS = 7;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function exigirGestor(ctx: OrgContext) {
  exigirPermissao(ctx, "gerenciar_equipe");
}

function exigirPodeDar(ctx: OrgContext, role: OrgRole) {
  if (role === "owner" && ctx.role !== "owner") {
    throw new ForbiddenError("Só o proprietário pode tornar alguém proprietário.");
  }
}

export interface CreatedInvite {
  id: string;
  /** Token em claro. É a única vez que ele existe: mostre e não guarde. */
  token: string;
}

export async function createInvite(
  ctx: OrgContext,
  input: { email: string; role: OrgRole },
): Promise<CreatedInvite> {
  exigirGestor(ctx);
  exigirPodeDar(ctx, input.role);
  const email = input.email.trim().toLowerCase();

  return withOrg(ctx, async (tx) => {
    const [jaMembro] = await tx
      .select({ userId: orgMembers.userId })
      .from(orgMembers)
      .innerJoin(profiles, eq(profiles.id, orgMembers.userId))
      .where(and(eq(orgMembers.orgId, ctx.orgId), sql`lower(${profiles.email}) = ${email}`))
      .limit(1);
    if (jaMembro) throw new DomainError("Esse e-mail já está na equipe.", "already_member");

    // Convite novo para o mesmo e-mail substitui o anterior.
    await tx
      .update(orgInvites)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(orgInvites.orgId, ctx.orgId),
          eq(orgInvites.email, email),
          isNull(orgInvites.acceptedAt),
          isNull(orgInvites.revokedAt),
        ),
      );

    const token = randomBytes(32).toString("base64url");
    const [created] = await tx
      .insert(orgInvites)
      .values({
        orgId: ctx.orgId,
        email,
        role: input.role,
        tokenHash: hashToken(token),
        invitedBy: ctx.userId,
        expiresAt: new Date(Date.now() + VALIDADE_DO_CONVITE_DIAS * 24 * 60 * 60 * 1000),
      })
      .returning({ id: orgInvites.id });
    if (!created) throw new Error("Falha ao gerar o convite.");
    return { id: created.id, token };
  });
}

/** Convites ainda em aberto (nem aceitos, nem cancelados, nem vencidos). */
export async function listPendingInvites(ctx: OrgContext) {
  return withOrg(ctx, (tx) =>
    tx
      .select({
        id: orgInvites.id,
        email: orgInvites.email,
        role: orgInvites.role,
        expiresAt: orgInvites.expiresAt,
        createdAt: orgInvites.createdAt,
      })
      .from(orgInvites)
      .where(
        and(
          eq(orgInvites.orgId, ctx.orgId),
          isNull(orgInvites.acceptedAt),
          isNull(orgInvites.revokedAt),
          gt(orgInvites.expiresAt, sql`now()`),
        ),
      )
      .orderBy(desc(orgInvites.createdAt)),
  );
}

export async function revokeInvite(ctx: OrgContext, inviteId: string) {
  exigirGestor(ctx);
  return withOrg(ctx, async (tx) => {
    await tx
      .update(orgInvites)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(orgInvites.orgId, ctx.orgId), eq(orgInvites.id, inviteId)));
  });
}

export interface InviteSummary {
  id: string;
  orgId: string;
  orgName: string;
  email: string;
  role: OrgRole;
  /** Motivo de não valer mais, ou `null` se ainda dá para aceitar. */
  problema: "aceito" | "cancelado" | "vencido" | null;
}

/**
 * Lê o convite pelo token. Roda na conexão administrativa: quem abre o link
 * ainda não é da equipe, então não há escritório para a RLS usar.
 */
export async function findInvite(token: string): Promise<InviteSummary | null> {
  if (!token || token.length < 20) return null;
  const [row] = await getAdminDb()
    .select({
      id: orgInvites.id,
      orgId: orgInvites.orgId,
      orgName: orgs.name,
      email: orgInvites.email,
      role: orgInvites.role,
      expiresAt: orgInvites.expiresAt,
      acceptedAt: orgInvites.acceptedAt,
      revokedAt: orgInvites.revokedAt,
    })
    .from(orgInvites)
    .innerJoin(orgs, eq(orgs.id, orgInvites.orgId))
    .where(eq(orgInvites.tokenHash, hashToken(token)))
    .limit(1);
  if (!row) return null;

  const problema = row.acceptedAt
    ? "aceito"
    : row.revokedAt
      ? "cancelado"
      : row.expiresAt.getTime() < Date.now()
        ? "vencido"
        : null;
  return {
    id: row.id,
    orgId: row.orgId,
    orgName: row.orgName,
    email: row.email,
    role: row.role,
    problema,
  };
}

/**
 * Aceita o convite: o usuário logado entra na equipe com o papel convidado.
 * O e-mail da conta precisa ser o do convite — o link sozinho não basta, para
 * um link encaminhado não colocar outra pessoa no escritório.
 */
export async function acceptInvite(
  token: string,
  user: { id: string; email: string },
): Promise<{ orgId: string }> {
  return getAdminDb().transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(orgInvites)
      .where(eq(orgInvites.tokenHash, hashToken(token)))
      .for("update")
      .limit(1);
    if (!invite) throw new NotFoundError("Convite");
    if (invite.acceptedAt) throw new DomainError("Este convite já foi usado.", "invite_used");
    if (invite.revokedAt) throw new DomainError("Este convite foi cancelado.", "invite_revoked");
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new DomainError("Este convite venceu. Peça um novo.", "invite_expired");
    }
    if (invite.email !== user.email.trim().toLowerCase()) {
      throw new DomainError(
        `Este convite é para ${invite.email}. Entre com esse e-mail para aceitar.`,
        "invite_email",
      );
    }

    // Quem já é da equipe mantém o papel que tem.
    await tx
      .insert(orgMembers)
      .values({ orgId: invite.orgId, userId: user.id, role: invite.role })
      .onConflictDoNothing();
    await tx
      .update(orgInvites)
      .set({ acceptedAt: new Date(), acceptedBy: user.id, updatedAt: new Date() })
      .where(eq(orgInvites.id, invite.id));

    return { orgId: invite.orgId };
  });
}

async function papelAtual(tx: Tx, ctx: OrgContext, userId: string): Promise<OrgRole> {
  const [member] = await tx
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, ctx.orgId), eq(orgMembers.userId, userId)))
    .limit(1);
  if (!member) throw new NotFoundError("Usuário");
  return member.role;
}

async function exigirOutroProprietario(tx: Tx, ctx: OrgContext) {
  const [row] = await tx
    .select({ total: sql<number>`count(*)::int` })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, ctx.orgId), eq(orgMembers.role, "owner")));
  if ((row?.total ?? 0) <= 1) {
    throw new DomainError("O escritório precisa de pelo menos um proprietário.", "last_owner");
  }
}

export async function updateMemberRole(ctx: OrgContext, userId: string, role: OrgRole) {
  exigirGestor(ctx);
  if (userId === ctx.userId) {
    throw new DomainError("Você não pode mudar o seu próprio papel.", "self_role");
  }
  exigirPodeDar(ctx, role);

  return withOrg(ctx, async (tx) => {
    const atual = await papelAtual(tx, ctx, userId);
    if (atual === role) return;
    if (atual === "owner") {
      exigirPodeDar(ctx, atual);
      await exigirOutroProprietario(tx, ctx);
    }
    await tx
      .update(orgMembers)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(orgMembers.orgId, ctx.orgId), eq(orgMembers.userId, userId)));
  });
}

export async function removeMember(ctx: OrgContext, userId: string) {
  exigirGestor(ctx);
  if (userId === ctx.userId) {
    throw new DomainError("Você não pode se tirar da equipe.", "self_remove");
  }

  return withOrg(ctx, async (tx) => {
    const atual = await papelAtual(tx, ctx, userId);
    if (atual === "owner") {
      exigirPodeDar(ctx, atual);
      await exigirOutroProprietario(tx, ctx);
    }
    await tx
      .delete(orgMembers)
      .where(and(eq(orgMembers.orgId, ctx.orgId), eq(orgMembers.userId, userId)));
  });
}
