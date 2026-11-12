import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { personInputSchema, processInputSchema } from "@corr/core";
import { getAdminDb } from "../client";
import { createTestOrg, destroyTestOrg, CPFS_VALIDOS, type TestOrg } from "../testing/fixtures";
import { createPerson } from "./people";
import { createProcess, listStalledProcesses, setProcessStatus } from "./processes";
import { registerDocument } from "./documents";

const admin = getAdminDb();
let orgA: TestOrg;
let orgB: TestOrg;

/** Joga a vida inteira do processo para `dias` atrás. */
async function envelhecer(processId: string, dias: number) {
  await admin.execute(
    sql`update processes set updated_at = now() - make_interval(days => ${dias}) where id = ${processId}`,
  );
  await admin.execute(
    sql`update process_events set created_at = now() - make_interval(days => ${dias}) where process_id = ${processId}`,
  );
  await admin.execute(
    sql`update documents set created_at = now() - make_interval(days => ${dias}) where process_id = ${processId}`,
  );
}

async function novoProcesso(org: TestOrg, cpf: string, nome: string) {
  const person = await createPerson(org.ctx, personInputSchema.parse({ cpf, fullName: nome }));
  return createProcess(org.ctx, processInputSchema.parse({ personId: person.id }));
}

beforeAll(async () => {
  orgA = await createTestOrg("parados-a");
  orgB = await createTestOrg("parados-b");
});

afterAll(async () => {
  await destroyTestOrg(orgA);
  await destroyTestOrg(orgB);
});

describe("processos parados", () => {
  it("lista só o ativo sem movimento há mais dias que o limite, com os dias e a etapa", async () => {
    const recente = await novoProcesso(orgA, CPFS_VALIDOS[0], "Recente da Silva");
    const esquecido = await novoProcesso(orgA, CPFS_VALIDOS[1], "Esquecido Pereira");
    await envelhecer(esquecido.id, 12);

    const parados = await listStalledProcesses(orgA.ctx, 7);
    expect(parados.map((p) => p.id)).toEqual([esquecido.id]);
    expect(parados[0]!.diasParado).toBe(12);
    expect(parados[0]!.etapa).toBeTruthy();
    expect(parados.map((p) => p.id)).not.toContain(recente.id);
  });

  it("documento recebido conta como movimento", async () => {
    const proc = await novoProcesso(orgA, CPFS_VALIDOS[2], "Mandou Documento");
    await registerDocument(orgA.ctx, {
      processId: proc.id,
      type: "outro",
      title: "comprovante.pdf",
      storagePath: `${orgA.orgId}/teste/comprovante.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 10,
    });
    await envelhecer(proc.id, 20);
    expect((await listStalledProcesses(orgA.ctx, 7)).map((p) => p.id)).toContain(proc.id);

    // Um documento novo hoje tira o processo da lista.
    await admin.execute(sql`update documents set created_at = now() where process_id = ${proc.id}`);
    expect((await listStalledProcesses(orgA.ctx, 7)).map((p) => p.id)).not.toContain(proc.id);
  });

  it("encerrado não conta e outro escritório não vê", async () => {
    const proc = await novoProcesso(orgA, CPFS_VALIDOS[3], "Já Cancelado");
    await setProcessStatus(orgA.ctx, proc.id, "cancelado");
    await envelhecer(proc.id, 30);

    expect((await listStalledProcesses(orgA.ctx, 7)).map((p) => p.id)).not.toContain(proc.id);
    expect(await listStalledProcesses(orgB.ctx, 7)).toEqual([]);
  });
});
