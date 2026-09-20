import { createHash, randomBytes } from "node:crypto";
import { type OrgContext, DomainError } from "@corr/core";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getAdminDb, withOrg } from "../client";
import { accessLinks, documents } from "../schema/documents";
import { people } from "../schema/people";
import { processes, processParticipants } from "../schema/processes";

/**
 * O token só existe em texto uma vez: no momento em que é gerado e entregue.
 * O banco guarda o hash, então um vazamento da base não abre o portal de
 * ninguém — mesma lógica de senha.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreatedAccessLink {
  id: string;
  /** Token em claro. É a única vez que ele existe: mostre e não guarde. */
  token: string;
  label: string;
  expiresAt: Date | null;
}

export async function createAccessLink(
  ctx: OrgContext,
  input: { processId: string; label: string; canUpload?: boolean; expiresInDays?: number },
): Promise<CreatedAccessLink> {
  // Validade não informada significa link sem prazo. Já um número zero ou
  // negativo é entrada sem sentido — e deixar isso virar link permanente, em
  // silêncio, é exatamente o erro que ninguém percebe até vazar.
  if (input.expiresInDays !== undefined && input.expiresInDays <= 0) {
    throw new DomainError("A validade do link precisa ser de pelo menos um dia.", "invalid_expiry");
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  return withOrg(ctx, async (tx) => {
    const [created] = await tx
      .insert(accessLinks)
      .values({
        orgId: ctx.orgId,
        processId: input.processId,
        tokenHash: hashToken(token),
        label: input.label,
        canUpload: input.canUpload ?? true,
        expiresAt,
        createdBy: ctx.userId,
      })
      .returning({ id: accessLinks.id, label: accessLinks.label, expiresAt: accessLinks.expiresAt });

    if (!created) throw new Error("Falha ao gerar o link de acesso.");
    return { ...created, token };
  });
}

export async function listAccessLinks(ctx: OrgContext, processId: string) {
  return withOrg(ctx, (tx) =>
    tx
      .select({
        id: accessLinks.id,
        label: accessLinks.label,
        canUpload: accessLinks.canUpload,
        lastAccessAt: accessLinks.lastAccessAt,
        accessCount: accessLinks.accessCount,
        createdAt: accessLinks.createdAt,
        // O relógio que vale é o do banco, o mesmo que decide se o token
        // ainda abre o portal — e comparar datas no render seria impuro.
        expired: sql<boolean>`${accessLinks.expiresAt} is not null and ${accessLinks.expiresAt} < now()`,
        revoked: sql<boolean>`${accessLinks.revokedAt} is not null`,
      })
      .from(accessLinks)
      .where(and(eq(accessLinks.orgId, ctx.orgId), eq(accessLinks.processId, processId)))
      .orderBy(desc(accessLinks.createdAt)),
  );
}

export async function revokeAccessLink(ctx: OrgContext, linkId: string) {
  return withOrg(ctx, async (tx) => {
    await tx
      .update(accessLinks)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(accessLinks.orgId, ctx.orgId), eq(accessLinks.id, linkId)));
  });
}

export interface PortalSession {
  linkId: string;
  orgId: string;
  processId: string;
  label: string;
  canUpload: boolean;
}

/**
 * Resolve um token do portal público.
 *
 * Roda na conexão administrativa porque quem acessa não tem sessão nem
 * escritório definido ainda — é justamente este passo que descobre a qual
 * escritório o visitante pertence. Depois daqui, todo acesso a dado volta a
 * passar por `withOrg` com o `orgId` que saiu do link.
 */
export async function resolvePortalToken(token: string): Promise<PortalSession | null> {
  if (!token || token.length < 20) return null;

  const [link] = await getAdminDb()
    .select({
      id: accessLinks.id,
      orgId: accessLinks.orgId,
      processId: accessLinks.processId,
      label: accessLinks.label,
      canUpload: accessLinks.canUpload,
      expiresAt: accessLinks.expiresAt,
      revokedAt: accessLinks.revokedAt,
    })
    .from(accessLinks)
    .where(and(eq(accessLinks.tokenHash, hashToken(token)), isNull(accessLinks.revokedAt)))
    .limit(1);

  if (!link) return null;
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return null;

  return {
    linkId: link.id,
    orgId: link.orgId,
    processId: link.processId,
    label: link.label,
    canUpload: link.canUpload,
  };
}

export async function registerPortalAccess(linkId: string): Promise<void> {
  await getAdminDb()
    .update(accessLinks)
    .set({
      lastAccessAt: new Date(),
      accessCount: sql`${accessLinks.accessCount} + 1`,
    })
    .where(eq(accessLinks.id, linkId));
}

/**
 * Resumo do processo para o portal do terceiro.
 *
 * Devolve só o que o visitante pode ver: andamento e identificação mínima.
 * Valores, comissões e dados dos outros participantes não saem daqui.
 */
export async function getPortalProcessSummary(session: PortalSession) {
  const [row] = await getAdminDb()
    .select({
      number: processes.number,
      stage: processes.stage,
      status: processes.status,
      updatedAt: processes.updatedAt,
      clientName: people.fullName,
      flowId: processes.flowId,
    })
    .from(processes)
    .innerJoin(people, eq(people.id, processes.personId))
    .where(and(eq(processes.orgId, session.orgId), eq(processes.id, session.processId)))
    .limit(1);

  if (!row) throw new DomainError("Processo não encontrado.", "not_found", 404);
  return row;
}

/** Participantes do processo, só nome — para o portal confirmar de quem é. */
export async function getPortalParticipants(session: PortalSession) {
  return getAdminDb()
    .select({ fullName: people.fullName, role: processParticipants.role })
    .from(processParticipants)
    .innerJoin(people, eq(people.id, processParticipants.personId))
    .where(
      and(
        eq(processParticipants.orgId, session.orgId),
        eq(processParticipants.processId, session.processId),
      ),
    );
}

/**
 * Documentos visíveis no portal.
 *
 * Só os que chegaram por links de acesso do mesmo processo: o visitante vê o
 * que ele (ou outro terceiro) enviou, nunca os documentos internos do
 * escritório, que podem conter análise e parecer de crédito.
 */
export async function listPortalDocuments(session: PortalSession) {
  return getAdminDb()
    .select({
      id: documents.id,
      title: documents.title,
      type: documents.type,
      status: documents.status,
      createdAt: documents.createdAt,
      uploadedByName: documents.uploadedByName,
    })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, session.orgId),
        eq(documents.processId, session.processId),
        eq(documents.source, "portal"),
      ),
    )
    .orderBy(desc(documents.createdAt));
}

/** Tipos de documento já recebidos no processo, para montar o checklist. */
export async function listPortalReceivedTypes(session: PortalSession): Promise<string[]> {
  const rows = await getAdminDb()
    .select({ type: documents.type, status: documents.status })
    .from(documents)
    .where(and(eq(documents.orgId, session.orgId), eq(documents.processId, session.processId)));

  return rows.filter((row) => row.status !== "rejeitado").map((row) => row.type);
}

export interface PortalUploadInput {
  type: string;
  title: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  senderName: string;
}

/**
 * Registra um envio feito pelo portal.
 *
 * Roda na conexão administrativa porque quem envia não tem conta: o escritório
 * vem do link, não de uma sessão. O `org_id` e o `process_id` são os do token,
 * nunca os que o formulário mandou.
 */
export async function registerPortalDocument(
  session: PortalSession,
  input: PortalUploadInput,
) {
  if (!session.canUpload) {
    throw new DomainError("Este link não permite envio de documentos.", "forbidden", 403);
  }

  const [created] = await getAdminDb()
    .insert(documents)
    .values({
      orgId: session.orgId,
      processId: session.processId,
      type: input.type as never,
      title: input.title,
      storagePath: input.storagePath,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      source: "portal",
      uploadedByName: input.senderName || session.label,
    })
    .returning({ id: documents.id });

  return created;
}

/** Checklist consolidado do processo, para o portal mostrar o que falta. */
export async function getPortalStageRequirements(
  session: PortalSession,
  requirements: { documentType: string; required: boolean; note?: string }[],
) {
  if (requirements.length === 0) return [];
  const types = requirements.map((r) => r.documentType);

  const rows = await getAdminDb()
    .select({ type: documents.type, status: documents.status })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, session.orgId),
        eq(documents.processId, session.processId),
        inArray(documents.type, types as never[]),
      ),
    );

  return requirements.map((requirement) => ({
    ...requirement,
    satisfied: rows.some(
      (row) => row.type === requirement.documentType && row.status !== "rejeitado",
    ),
  }));
}
