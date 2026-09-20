import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/routes";

/**
 * Destino dos links de e-mail do Supabase (confirmação de cadastro, convite,
 * recuperação de senha). Troca o `token_hash` por uma sessão em cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/painel";

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/login?erro=link_invalido", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(new URL("/login?erro=link_expirado", request.url));
  }

  return NextResponse.redirect(new URL(safeInternalPath(next), request.url));
}
