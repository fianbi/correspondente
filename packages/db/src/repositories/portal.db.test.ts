import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getAdminDb } from "../client";
import { personInputSchema, processInputSchema } from "@corr/core";
import { CPFS_VALIDOS, createTestOrg, destroyTestOrg, type TestOrg } from "../testing/fixtures";
import { createPerson } from "./people";
import { createProcess } from "./processes";
import {
  createAccessLink,
  listAccessLinks,
  listPortalDocuments,
  registerPortalAccess,
  registerPortalDocument,
  resolvePortalToken,
  revokeAccessLink,
} from "./access-links";
import { buildChecklist, listProcessDocuments, registerDocument, reviewDocument } from "./documents";
import { countOpenPendencies, createPendency, listOpenPendencies, resolvePendency } from "./pendencies";

let org: TestOrg;
let outraOrg: TestOrg;
let processId: string;

beforeAll(async () => {
  org = await createTestOrg("portal-a");
  outraOrg = await createTestOrg("portal-b");

  const person = await createPerson(
    org.ctx,
    personInputSchema.parse({ cpf: CPFS_VALIDOS[0], fullName: "Ana Paula Ribeiro" }),
  );
  const process = await createProcess(org.ctx, processInputSchema.parse({ personId: person.id }));
  processId = process.id;
});

afterAll(async () => {
  await destroyTestOrg(org);
  await destroyTestOrg(outraOrg);
});

describe("link de acesso", () => {
  it("o token só existe em claro no momento da criação", async () => {
    const link = await createAccessLink(org.ctx, { processId, label: "Cliente" });

    expect(link.token.length).toBeGreaterThan(30);

    // A listagem devolve metadados, nunca o token: se o banco vazar, nenhum
    // portal é aberto com o que estiver lá dentro.
    const listados = await listAccessLinks(org.ctx, processId);
    const serializado = JSON.stringify(listados);
    expect(serializado).not.toContain(link.token);
  });

  it("resolve o token para o escritório e o processo certos", async () => {
    const link = await createAccessLink(org.ctx, { processId, label: "Corretor" });
    const session = await resolvePortalToken(link.token);

    expect(session).toMatchObject({ orgId: org.orgId, processId, canUpload: true });
  });

  it("token inventado não abre nada", async () => {
    expect(await resolvePortalToken("token-falso-mas-comprido-o-suficiente")).toBeNull();
    expect(await resolvePortalToken("")).toBeNull();
  });

  it("link revogado para de funcionar", async () => {
    const link = await createAccessLink(org.ctx, { processId, label: "Temporário" });
    const [criado] = await listAccessLinks(org.ctx, processId);
    expect(criado).toBeDefined();

    const session = await resolvePortalToken(link.token);
    expect(session).not.toBeNull();

    await revokeAccessLink(org.ctx, session!.linkId);
    expect(await resolvePortalToken(link.token)).toBeNull();
  });

  it("validade sem sentido é recusada em vez de virar link permanente", async () => {
    await expect(
      createAccessLink(org.ctx, { processId, label: "Inválido", expiresInDays: 0 }),
    ).rejects.toThrow(/pelo menos um dia/i);
  });

  it("link expirado para de funcionar", async () => {
    const link = await createAccessLink(org.ctx, {
      processId,
      label: "Expirado",
      expiresInDays: 1,
    });
    const session = await resolvePortalToken(link.token);
    expect(session).not.toBeNull();

    // Envelhece o link no banco para não depender de esperar um dia real.
    await getAdminDb().execute(
      sql`update public.access_links set expires_at = now() - interval '1 hour' where id = ${session!.linkId}`,
    );

    expect(await resolvePortalToken(link.token)).toBeNull();
  });

  it("conta os acessos para o escritório saber se o cliente abriu", async () => {
    const link = await createAccessLink(org.ctx, { processId, label: "Contagem" });
    const session = await resolvePortalToken(link.token);
    await registerPortalAccess(session!.linkId);
    await registerPortalAccess(session!.linkId);

    const links = await listAccessLinks(org.ctx, processId);
    const alvo = links.find((l) => l.label === "Contagem");
    expect(alvo?.accessCount).toBe(2);
  });

  it("um escritório não enxerga os links do outro", async () => {
    const links = await listAccessLinks(outraOrg.ctx, processId);
    expect(links).toEqual([]);
  });
});

describe("documentos", () => {
  it("envio pelo portal fica marcado com a origem e o remetente", async () => {
    const link = await createAccessLink(org.ctx, { processId, label: "Cliente" });
    const session = await resolvePortalToken(link.token);

    await registerPortalDocument(session!, {
      type: "rg",
      title: "rg-frente.pdf",
      storagePath: `${org.orgId}/${processId}/rg.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1024,
      senderName: "Ana Paula",
    });

    const doPortal = await listPortalDocuments(session!);
    expect(doPortal[0]).toMatchObject({ title: "rg-frente.pdf", uploadedByName: "Ana Paula" });
  });

  it("link somente leitura não consegue enviar", async () => {
    const link = await createAccessLink(org.ctx, {
      processId,
      label: "Só acompanha",
      canUpload: false,
    });
    const session = await resolvePortalToken(link.token);

    await expect(
      registerPortalDocument(session!, {
        type: "rg",
        title: "x.pdf",
        storagePath: `${org.orgId}/${processId}/x.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 10,
        senderName: "Alguém",
      }),
    ).rejects.toThrow(/não permite/i);
  });

  it("documento interno não aparece no portal do terceiro", async () => {
    await registerDocument(org.ctx, {
      processId,
      type: "laudo_avaliacao",
      title: "parecer-interno.pdf",
      storagePath: `${org.orgId}/${processId}/parecer.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 2048,
      source: "interno",
    });

    const link = await createAccessLink(org.ctx, { processId, label: "Cliente" });
    const session = await resolvePortalToken(link.token);
    const doPortal = await listPortalDocuments(session!);

    // Parecer de crédito não é assunto do cliente: o portal mostra só o que
    // chegou por link, nunca o que a equipe produziu internamente.
    expect(doPortal.map((d) => d.title)).not.toContain("parecer-interno.pdf");

    const internos = await listProcessDocuments(org.ctx, processId);
    expect(internos.map((d) => d.title)).toContain("parecer-interno.pdf");
  });

  it("checklist marca o que chegou e ignora o que foi rejeitado", async () => {
    const requisitos = [
      { documentType: "comprovante_residencia", required: true },
      { documentType: "iptu", required: false },
    ];

    let checklist = await buildChecklist(org.ctx, processId, requisitos);
    expect(checklist.map((i) => i.satisfied)).toEqual([false, false]);

    const doc = await registerDocument(org.ctx, {
      processId,
      type: "comprovante_residencia",
      title: "conta-luz.pdf",
      storagePath: `${org.orgId}/${processId}/luz.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 512,
    });

    checklist = await buildChecklist(org.ctx, processId, requisitos);
    expect(checklist[0]?.satisfied).toBe(true);

    await reviewDocument(org.ctx, doc.id, "rejeitado");
    checklist = await buildChecklist(org.ctx, processId, requisitos);
    // Rejeitado não satisfaz: a etapa não pode parecer completa com um arquivo
    // que a análise já recusou.
    expect(checklist[0]?.satisfied).toBe(false);
  });

  it("um escritório não lista documentos do outro", async () => {
    const deFora = await listProcessDocuments(outraOrg.ctx, processId);
    expect(deFora).toEqual([]);
  });
});

describe("pendências", () => {
  it("entra na visão global e sai quando resolvida", async () => {
    const pendency = await createPendency(org.ctx, {
      processId,
      title: "Falta comprovante de renda atualizado",
    });

    expect(await countOpenPendencies(org.ctx, processId)).toBe(1);

    const abertas = await listOpenPendencies(org.ctx);
    expect(abertas.map((p) => p.id)).toContain(pendency.id);

    await resolvePendency(org.ctx, pendency.id);
    expect(await countOpenPendencies(org.ctx, processId)).toBe(0);
    expect((await listOpenPendencies(org.ctx)).map((p) => p.id)).not.toContain(pendency.id);
  });

  it("não vaza entre escritórios", async () => {
    await createPendency(org.ctx, { processId, title: "Interna" });
    expect(await listOpenPendencies(outraOrg.ctx)).toEqual([]);
  });
});
