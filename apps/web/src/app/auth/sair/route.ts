import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/server/session";
import { safeInternalPath } from "@/lib/routes";

/** Logout por POST: GET seria disparado por prefetch e derrubaria a sessão sozinho. */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  // `scope: "local"` encerra só esta sessão. O padrão do Supabase é "global",
  // que revoga o refresh token em todos os dispositivos — sair no computador do
  // escritório derrubaria o celular do mesmo operador no meio de um atendimento.
  await supabase.auth.signOut({ scope: "local" });

  // `next` traz de volta para onde a pessoa estava (ex.: o link de convite,
  // quando ela entrou com o e-mail errado).
  const form = await request.formData().catch(() => null);
  const next = form?.get("next")?.toString();
  const destino = new URL("/login", request.url);
  if (next) destino.searchParams.set("next", safeInternalPath(next));

  const response = NextResponse.redirect(destino, { status: 303 });
  response.cookies.delete(ACTIVE_ORG_COOKIE);
  return response;
}
