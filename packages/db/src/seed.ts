import "./load-env";

import { createClient } from "@supabase/supabase-js";
import { eq, sql } from "drizzle-orm";
import { getAdminDb } from "./client";
import { resetDefaultFlow } from "./repositories/flows";
import { banks } from "./schema/catalogs";
import { orgCounters, orgMembers, orgs } from "./schema/orgs";
import { people } from "./schema/people";
import { processes, processParticipants } from "./schema/processes";

/**
 * Seed de desenvolvimento: bancos de referência (dado global e real), um
 * usuário confirmado, um escritório e alguns processos para a esteira não
 * nascer vazia. Idempotente — rodar de novo não duplica nada.
 *
 * As pessoas aqui são fictícias de propósito: nenhum CPF real entra no
 * repositório. Os CPFs abaixo passam no dígito verificador mas não pertencem
 * a ninguém em particular.
 */

const BANCOS = [
  { code: "104", name: "Caixa Econômica Federal", shortName: "Caixa" },
  { code: "001", name: "Banco do Brasil S.A.", shortName: "Banco do Brasil" },
  { code: "237", name: "Banco Bradesco S.A.", shortName: "Bradesco" },
  { code: "341", name: "Itaú Unibanco S.A.", shortName: "Itaú" },
  { code: "033", name: "Banco Santander (Brasil) S.A.", shortName: "Santander" },
  { code: "077", name: "Banco Inter S.A.", shortName: "Inter" },
];

const PESSOAS = [
  {
    cpf: "11144477735",
    fullName: "ANA PAULA RIBEIRO",
    email: "ana.ribeiro@exemplo.test",
    phone: "11987654321",
    city: "São Paulo",
    uf: "SP",
    maritalStatus: "casado_comunhao_parcial" as const,
    spouseName: "CARLOS EDUARDO RIBEIRO",
  },
  {
    cpf: "52998224725",
    fullName: "BRUNO MARTINS DE SOUZA",
    email: "bruno.souza@exemplo.test",
    phone: "11912345678",
    city: "Campinas",
    uf: "SP",
    maritalStatus: "solteiro" as const,
  },
  {
    cpf: "15350946056",
    fullName: "CLARA NOGUEIRA LIMA",
    email: "clara.lima@exemplo.test",
    phone: "19998887766",
    city: "Ribeirão Preto",
    uf: "SP",
    maritalStatus: "uniao_estavel" as const,
    spouseName: "DIEGO NOGUEIRA LIMA",
  },
];

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios. Veja .env.example.",
    );
  }

  const email = process.env.SEED_USER_EMAIL ?? "dev@correspondente.local";
  const password = process.env.SEED_USER_PASSWORD ?? "dev12345678";

  const auth = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string | undefined;
  const created = await auth.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Usuário de Desenvolvimento" },
  });

  if (created.error) {
    const { data, error } = await auth.auth.admin.listUsers({ perPage: 200 });
    if (error) throw error;
    userId = data.users.find((user) => user.email === email)?.id;
    if (!userId) throw created.error;

    // Sincroniza a senha com o .env.local. Sem isso, trocar a senha no
    // ambiente não teria efeito nenhum: o usuário já existe e o seed
    // simplesmente seguiria em frente com a senha antiga.
    const atualizado = await auth.auth.admin.updateUserById(userId, { password });
    if (atualizado.error) throw atualizado.error;

    console.log(`usuário ${email} já existia — senha sincronizada com o ambiente`);
  } else {
    userId = created.data.user.id;
    console.log(`usuário ${email} criado`);
  }

  const db = getAdminDb();

  await db.insert(banks).values(BANCOS).onConflictDoNothing({ target: banks.code });
  console.log(`${BANCOS.length} bancos de referência garantidos`);

  const [existingOrg] = await db.select().from(orgs).where(eq(orgs.slug, "escritorio-demo")).limit(1);
  const org =
    existingOrg ??
    (
      await db
        .insert(orgs)
        .values({ name: "Escritório Demo", slug: "escritorio-demo", city: "São Paulo", email })
        .returning()
    )[0];

  if (!org) throw new Error("Falha ao criar o escritório de demonstração.");

  await db.insert(orgMembers).values({ orgId: org.id, userId, role: "owner" }).onConflictDoNothing();
  await db.insert(orgCounters).values({ orgId: org.id }).onConflictDoNothing();

  // Recria o fluxo a cada seed para o ambiente de desenvolvimento acompanhar o
  // fluxo padrão do código (inclusive o checklist de cada etapa).
  await resetDefaultFlow({ orgId: org.id, userId, role: "owner" });
  console.log("fluxo padrão recriado");

  const [caixa] = await db.select().from(banks).where(eq(banks.code, "104")).limit(1);

  for (const [index, pessoa] of PESSOAS.entries()) {
    const [existing] = await db.select().from(people).where(eq(people.cpf, pessoa.cpf)).limit(1);
    const person =
      existing ??
      (await db.insert(people).values({ ...pessoa, orgId: org.id }).returning())[0];
    if (!person) continue;

    const [alreadyHasProcess] = await db
      .select({ id: processes.id })
      .from(processes)
      .where(eq(processes.personId, person.id))
      .limit(1);
    if (alreadyHasProcess) continue;

    const [counter] = await db
      .update(orgCounters)
      .set({ nextProcessNumber: sql`next_process_number + 1` })
      .where(eq(orgCounters.orgId, org.id))
      .returning({ next: orgCounters.nextProcessNumber });
    if (!counter) throw new Error("Contador de processos não encontrado.");

    const [process] = await db
      .insert(processes)
      .values({
        orgId: org.id,
        number: counter.next - 1,
        personId: person.id,
        bankId: caixa?.id ?? null,
        stage: (["cadastro", "correspondente", "montagem"] as const)[index] ?? "cadastro",
        status: (["em_aberto", "aguardando", "aprovado"] as const)[index] ?? "em_aberto",
        modality: "aquisicao_imovel_usado",
        amortizationSystem: "sac",
        propertyValueCents: [35000000, 48000000, 62000000][index] ?? 35000000,
        financedValueCents: [28000000, 38400000, 49600000][index] ?? 28000000,
        termMonths: 360,
        createdBy: userId,
      })
      .returning();

    if (process) {
      await db
        .insert(processParticipants)
        .values({ orgId: org.id, processId: process.id, personId: person.id, role: "proponente" })
        .onConflictDoNothing();
    }
  }

  console.log(`escritório "${org.name}" pronto com ${PESSOAS.length} pessoas e processos de exemplo`);
  console.log(`\nEntre em http://localhost:3000/login com:\n  e-mail: ${email}\n  senha:  ${password}\n`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
