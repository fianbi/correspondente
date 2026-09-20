import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Convenção do Next 16 (substitui o antigo `middleware.ts`). */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tudo, menos estáticos e imagens — o refresh de sessão não precisa rodar aí.
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
