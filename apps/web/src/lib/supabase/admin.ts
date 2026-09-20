import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Cliente com service role: ignora RLS e políticas de Storage.
 *
 * Usado só para emitir URLs assinadas de upload e download, depois que o
 * chamador já provou quem é (sessão da equipe ou token de link de acesso).
 * Nunca deve ser exposto ao cliente.
 */
let cached: ReturnType<typeof createClient> | undefined;

export function getSupabaseAdmin() {
  if (!cached) {
    cached = createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cached;
}
