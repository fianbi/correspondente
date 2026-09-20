"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isValidCnpj, onlyDigits } from "@corr/core";
import { createOrgWithOwner, listMembershipsForUser } from "@corr/db";
import { requireSessionUser, ACTIVE_ORG_COOKIE } from "@/server/session";
import { slugify } from "@/lib/utils";

export interface OrgFormState {
  error?: string;
}

const schema = z.object({
  name: z.string().min(3, "Informe o nome do escritório."),
  cnpj: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? onlyDigits(value) : ""))
    .refine((value) => value === "" || isValidCnpj(value), "CNPJ inválido."),
});

export async function createOrg(_prev: OrgFormState, formData: FormData): Promise<OrgFormState> {
  const user = await requireSessionUser();

  const parsed = schema.safeParse({
    name: formData.get("name"),
    cnpj: formData.get("cnpj"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const existing = await listMembershipsForUser(user.id);
  if (existing.length > 0) redirect("/painel");

  const base = slugify(parsed.data.name) || "escritorio";
  // Slug é único no banco; em colisão tenta variações antes de desistir, para o
  // usuário não ter que inventar outro nome por causa de um homônimo.
  let org: Awaited<ReturnType<typeof createOrgWithOwner>> | null = null;
  for (let attempt = 0; attempt < 5 && !org; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      org = await createOrgWithOwner({
        name: parsed.data.name,
        slug,
        cnpj: parsed.data.cnpj || null,
        ownerUserId: user.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("orgs_cnpj_unique")) {
        return { error: "Já existe um escritório cadastrado com este CNPJ." };
      }
      if (!message.includes("orgs_slug_unique")) throw error;
    }
  }

  if (!org) return { error: "Não foi possível criar o escritório. Tente outro nome." };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, org.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/painel");
}
