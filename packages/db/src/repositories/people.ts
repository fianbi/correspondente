import {
  type OrgContext,
  type PersonIncomeInput,
  type PersonInput,
  DomainError,
  NotFoundError,
  exigirPermissao,
  nomeParaConfirmar,
  onlyDigits,
} from "@corr/core";
import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { withOrg } from "../client";
import { people, personIncomes } from "../schema/people";
import { documents } from "../schema/documents";
import { processParticipants } from "../schema/processes";

/** CPF já cadastrado: o chamador precisa do id para oferecer "abrir cadastro". */
export class DuplicatePersonError extends DomainError {
  constructor(readonly personId: string, readonly fullName: string) {
    super(`${fullName} já está cadastrado com este CPF.`, "duplicate_cpf", 409);
    this.name = "DuplicatePersonError";
  }
}

export interface ListPeopleOptions {
  search?: string;
  limit?: number;
  offset?: number;
  /** `recent`: os atualizados por último primeiro (o painel da extensão). */
  order?: "name" | "recent";
}

export async function listPeople(ctx: OrgContext, options: ListPeopleOptions = {}) {
  const limit = Math.min(options.limit ?? 50, 200);
  const offset = options.offset ?? 0;
  const search = options.search?.trim();

  return withOrg(ctx, async (tx) => {
    // Busca única para nome e CPF: quem digita "456" está procurando documento,
    // quem digita "maria" está procurando nome — exigir escolher o campo antes
    // seria atrito à toa.
    const digits = search ? onlyDigits(search) : "";
    const filter = search
      ? or(
          ilike(people.fullName, `%${search}%`),
          digits.length >= 3 ? ilike(people.cpf, `${digits}%`) : undefined,
          // Celular em qualquer formato: compara só os dígitos, em qualquer
          // posição, para "99876-5432" achar "(11) 99876-5432".
          digits.length >= 4
            ? sql`regexp_replace(coalesce(${people.phone}, ''), '[^0-9]', '', 'g') like ${`%${digits}%`}`
            : undefined,
        )
      : undefined;

    const where = filter ? and(eq(people.orgId, ctx.orgId), filter) : eq(people.orgId, ctx.orgId);

    const [rows, [total]] = await Promise.all([
      tx
        .select({
          id: people.id,
          cpf: people.cpf,
          fullName: people.fullName,
          email: people.email,
          phone: people.phone,
          city: people.city,
          uf: people.uf,
          createdAt: people.createdAt,
          updatedAt: people.updatedAt,
        })
        .from(people)
        .where(where)
        .orderBy(options.order === "recent" ? desc(people.updatedAt) : asc(people.fullName))
        .limit(limit)
        .offset(offset),
      tx.select({ value: count() }).from(people).where(where),
    ]);

    return { rows, total: total?.value ?? 0, limit, offset };
  });
}

export async function getPerson(ctx: OrgContext, personId: string) {
  return withOrg(ctx, async (tx) => {
    const [person] = await tx
      .select()
      .from(people)
      .where(and(eq(people.orgId, ctx.orgId), eq(people.id, personId)))
      .limit(1);
    if (!person) throw new NotFoundError("Pessoa");
    return person;
  });
}

export async function findPersonByCpf(ctx: OrgContext, cpf: string) {
  const digits = onlyDigits(cpf);
  return withOrg(ctx, async (tx) => {
    const [person] = await tx
      .select({ id: people.id, fullName: people.fullName, cpf: people.cpf })
      .from(people)
      .where(and(eq(people.orgId, ctx.orgId), eq(people.cpf, digits)))
      .limit(1);
    return person ?? null;
  });
}

export async function createPerson(ctx: OrgContext, input: PersonInput) {
  return withOrg(ctx, async (tx) => {
    const [existing] = await tx
      .select({ id: people.id, fullName: people.fullName })
      .from(people)
      .where(and(eq(people.orgId, ctx.orgId), eq(people.cpf, input.cpf)))
      .limit(1);

    if (existing) throw new DuplicatePersonError(existing.id, existing.fullName);

    const [created] = await tx
      .insert(people)
      .values({ ...input, orgId: ctx.orgId, createdBy: ctx.userId })
      .returning();

    if (!created) throw new Error("Falha ao criar a pessoa.");
    return created;
  });
}

export async function updatePerson(ctx: OrgContext, personId: string, input: PersonInput) {
  return withOrg(ctx, async (tx) => {
    const [duplicate] = await tx
      .select({ id: people.id, fullName: people.fullName })
      .from(people)
      .where(and(eq(people.orgId, ctx.orgId), eq(people.cpf, input.cpf)))
      .limit(1);

    if (duplicate && duplicate.id !== personId) {
      throw new DuplicatePersonError(duplicate.id, duplicate.fullName);
    }

    const [updated] = await tx
      .update(people)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(people.orgId, ctx.orgId), eq(people.id, personId)))
      .returning();

    if (!updated) throw new NotFoundError("Pessoa");
    return updated;
  });
}

export async function listPersonIncomes(ctx: OrgContext, personId: string) {
  return withOrg(ctx, (tx) =>
    tx
      .select()
      .from(personIncomes)
      .where(and(eq(personIncomes.orgId, ctx.orgId), eq(personIncomes.personId, personId)))
      .orderBy(desc(personIncomes.createdAt)),
  );
}

export async function addPersonIncome(
  ctx: OrgContext,
  personId: string,
  input: PersonIncomeInput,
) {
  return withOrg(ctx, async (tx) => {
    const [created] = await tx
      .insert(personIncomes)
      .values({ ...input, orgId: ctx.orgId, personId })
      .returning();
    if (!created) throw new Error("Falha ao registrar a renda.");
    return created;
  });
}

/** Atualiza só os campos informados de uma renda. */
export async function updatePersonIncome(
  ctx: OrgContext,
  incomeId: string,
  input: Partial<PersonIncomeInput>,
) {
  return withOrg(ctx, async (tx) => {
    const [updated] = await tx
      .update(personIncomes)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(personIncomes.orgId, ctx.orgId), eq(personIncomes.id, incomeId)))
      .returning();
    if (!updated) throw new NotFoundError("Renda");
    return updated;
  });
}

export async function deletePersonIncome(ctx: OrgContext, incomeId: string) {
  return withOrg(ctx, async (tx) => {
    const deleted = await tx
      .delete(personIncomes)
      .where(and(eq(personIncomes.orgId, ctx.orgId), eq(personIncomes.id, incomeId)))
      .returning({ id: personIncomes.id });
    if (deleted.length === 0) throw new NotFoundError("Renda");
  });
}

/** Renda total considerada na análise: soma das rendas brutas cadastradas. */
export async function sumPersonGrossIncome(ctx: OrgContext, personId: string): Promise<number> {
  return withOrg(ctx, async (tx) => {
    const [row] = await tx
      .select({ total: sql<number>`coalesce(sum(${personIncomes.grossCents}), 0)::bigint` })
      .from(personIncomes)
      .where(and(eq(personIncomes.orgId, ctx.orgId), eq(personIncomes.personId, personId)));
    return Number(row?.total ?? 0);
  });
}

/**
 * Exclui a pessoa de vez. Quem chama confirma digitando o primeiro nome dela;
 * a conferência é feita aqui também, para nenhum outro caminho apagar sem ela.
 *
 * Só sai quem não está em nenhum processo: o processo depende da pessoa, e
 * tirar alguém de um processo é uma decisão à parte. Saem junto as rendas, as
 * avaliações de risco e os documentos que eram só do cadastro. Documento
 * pessoal enviado por um processo continua no processo, sem o dono.
 *
 * Devolve os caminhos dos arquivos que saíram, para quem chama apagar do
 * armazenamento (o banco não alcança o bucket).
 */
export async function deletePerson(
  ctx: OrgContext,
  personId: string,
  typedName: string,
): Promise<{ removedFiles: string[] }> {
  exigirPermissao(ctx, "excluir_pessoa");
  return withOrg(ctx, async (tx) => {
    const [person] = await tx
      .select({ fullName: people.fullName })
      .from(people)
      .where(and(eq(people.orgId, ctx.orgId), eq(people.id, personId)))
      .limit(1);
    if (!person) throw new NotFoundError("Pessoa");

    if (nomeParaConfirmar(typedName) !== nomeParaConfirmar(person.fullName)) {
      const primeiroNome = person.fullName.trim().split(/\s+/)[0];
      throw new DomainError(
        `Para excluir, digite o primeiro nome da pessoa (${primeiroNome}).`,
        "confirmation_mismatch",
      );
    }

    const [emProcessos] = await tx
      .select({ total: sql<number>`count(distinct ${processParticipants.processId})::int` })
      .from(processParticipants)
      .where(
        and(eq(processParticipants.orgId, ctx.orgId), eq(processParticipants.personId, personId)),
      );
    if ((emProcessos?.total ?? 0) > 0) {
      throw new DomainError(
        `${person.fullName} está em ${emProcessos!.total} processo(s). Tire a pessoa dos processos (ou exclua os processos) antes de excluir o cadastro.`,
        "person_in_use",
      );
    }

    const removed = await tx
      .delete(documents)
      .where(
        and(
          eq(documents.orgId, ctx.orgId),
          eq(documents.personId, personId),
          isNull(documents.processId),
        ),
      )
      .returning({ storagePath: documents.storagePath });

    await tx.delete(people).where(and(eq(people.orgId, ctx.orgId), eq(people.id, personId)));

    return { removedFiles: removed.map((row) => row.storagePath) };
  });
}
