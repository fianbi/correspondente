import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getAdminDb } from "./client";

/**
 * Guarda permanente do isolamento entre escritórios.
 *
 * O jeito mais fácil de furar a tenancy deste sistema não é escrever uma query
 * errada — é criar uma tabela nova e esquecer a policy. O vazamento fica
 * silencioso: nenhum teste de funcionalidade falha, e o dado de um escritório
 * aparece no outro só quando alguém reparar.
 *
 * Por isso a regra é verificada contra o catálogo do próprio Postgres, e não
 * contra uma lista escrita à mão que também poderia ser esquecida.
 */

const admin = getAdminDb();

/** Tabelas que não têm dono e são lidas por todos (dado público de referência). */
const GLOBAIS = new Set(["banks"]);

/** Controle interno do Drizzle, fora do modelo de dados da aplicação. */
const IGNORADAS = new Set(["__drizzle_migrations"]);

async function tabelasDaAplicacao() {
  const rows = await admin.execute<{ table_name: string; tem_org: boolean }>(sql`
    select
      t.table_name,
      exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = t.table_name
          and c.column_name = 'org_id'
      ) as tem_org
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
  `);

  return rows.filter((row) => !IGNORADAS.has(row.table_name));
}

describe("cobertura de RLS", () => {
  it("toda tabela com org_id tem RLS habilitada", async () => {
    const tabelas = await tabelasDaAplicacao();
    const comOrg = tabelas.filter((t) => t.tem_org).map((t) => t.table_name);
    expect(comOrg.length).toBeGreaterThan(5);

    const semRls = await admin.execute<{ relname: string }>(sql`
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relrowsecurity = false
    `);

    const faltando = semRls
      .map((row) => row.relname)
      .filter((nome) => comOrg.includes(nome));

    expect(faltando, `tabelas com org_id e sem RLS: ${faltando.join(", ")}`).toEqual([]);
  });

  it("toda tabela com RLS tem pelo menos uma policy", async () => {
    // RLS ligada sem policy nenhuma nega tudo — o que quebra a aplicação em
    // vez de vazar, mas quebra silenciosamente e longe da causa.
    const rows = await admin.execute<{ relname: string }>(sql`
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relrowsecurity = true
        and not exists (
          select 1 from pg_policies p
          where p.schemaname = 'public' and p.tablename = c.relname
        )
    `);

    expect(rows.map((row) => row.relname)).toEqual([]);
  });

  it("a policy de cada tabela filtra pelo escritório da transação", async () => {
    const rows = await admin.execute<{ tablename: string; qual: string | null }>(sql`
      select tablename, qual
      from pg_policies
      where schemaname = 'public'
    `);

    const suspeitas = rows.filter((row) => {
      if (GLOBAIS.has(row.tablename)) return false;
      const expressao = row.qual ?? "";
      // Aceita tanto o filtro direto por org_id quanto o de profiles, que
      // passa por org_members para descobrir quem compartilha escritório.
      return !expressao.includes("current_org_id()") && !expressao.includes("current_app_user_id()");
    });

    expect(
      suspeitas.map((s) => s.tablename),
      "policies que não amarram no escritório da transação",
    ).toEqual([]);
  });

  it("a role da aplicação não pode alterar nem apagar o histórico", async () => {
    // Auditoria só vale se for append-only: a permissão é a garantia, não a
    // disciplina de quem escreve o código.
    const rows = await admin.execute<{ privilege_type: string }>(sql`
      select privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'process_events'
        and grantee = 'app_user'
    `);

    const permissoes = rows.map((row) => row.privilege_type);
    expect(permissoes).toContain("INSERT");
    expect(permissoes).toContain("SELECT");
    expect(permissoes).not.toContain("UPDATE");
    expect(permissoes).not.toContain("DELETE");
  });

  it("a role da aplicação não escreve na tabela global de bancos", async () => {
    const rows = await admin.execute<{ privilege_type: string }>(sql`
      select privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'banks'
        and grantee = 'app_user'
    `);

    const permissoes = rows.map((row) => row.privilege_type);
    expect(permissoes).toContain("SELECT");
    expect(permissoes).not.toContain("INSERT");
    expect(permissoes).not.toContain("UPDATE");
  });
});
