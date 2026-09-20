"use server";

import { revalidatePath } from "next/cache";
import { createApiToken, revokeApiToken } from "@corr/db";
import { requireOrgContext } from "@/server/session";

export interface TokenState {
  token?: string;
  error?: string;
}

/**
 * Gera o token que a extensão usa para falar com o sistema.
 *
 * O valor volta uma única vez: o banco guarda só o hash. Se o usuário perder,
 * gera outro e revoga o antigo — não existe "mostrar de novo".
 */
export async function generateApiToken(
  _prev: TokenState,
  formData: FormData,
): Promise<TokenState> {
  const ctx = await requireOrgContext();

  const label = String(formData.get("label") ?? "").trim() || "Extensão do navegador";
  const created = await createApiToken(ctx, label);

  revalidatePath("/configuracoes/escritorio");
  return { token: created.token };
}

export async function revokeToken(tokenId: string): Promise<void> {
  const ctx = await requireOrgContext();
  await revokeApiToken(ctx, tokenId);
  revalidatePath("/configuracoes/escritorio");
}
