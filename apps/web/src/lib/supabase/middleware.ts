import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

/**
 * Rotas que não exigem sessão. A API da extensão (`/api/ext/`) autentica pela
 * sessão da web em `_auth.ts` e responde 401 em vez de redirecionar para
 * /login, que a extensão não teria como seguir. O refresh do cookie continua
 * rodando para ela.
 */
const PUBLIC_PREFIXES = ["/login", "/cadastro", "/auth", "/p/", "/api/ext/"];

const isPublic = (pathname: string) =>
  PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));

/**
 * Renova o token do Supabase a cada navegação e devolve a resposta já com os
 * cookies atualizados. Sem isso a sessão expira em cima do usuário no meio de
 * um processo sendo editado.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() valida o JWT no servidor do Supabase; getSession() só lê o cookie
  // e aceitaria um token forjado.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (pathname === "/login" || pathname === "/cadastro")) {
    const home = request.nextUrl.clone();
    home.pathname = "/painel";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}
