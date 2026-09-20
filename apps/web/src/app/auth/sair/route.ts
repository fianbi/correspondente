import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/server/session";

/** Logout por POST: GET seria disparado por prefetch e derrubaria a sessão sozinho. */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  // `scope: "local"` encerra só esta sessão. O padrão do Supabase é "global",
  // que revoga o refresh token em todos os dispositivos — sair no computador do
  // escritório derrubaria o celular do mesmo operador no meio de um atendimento.
  await supabase.auth.signOut({ scope: "local" });

  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  response.cookies.delete(ACTIVE_ORG_COOKIE);
  return response;
}
