import { z } from "zod";

const schema = z.object({
  /**
   * Conexão da aplicação. Aponta para a role `app_user`, que **não** tem
   * BYPASSRLS — se um repositório esquecer o filtro de org, a RLS ainda barra.
   */
  DATABASE_URL: z.string().min(1),
  /** Conexão privilegiada, só para migrations e rotinas administrativas. */
  DATABASE_ADMIN_URL: z.string().min(1).optional(),
});

export type DbEnv = z.infer<typeof schema>;

export function readDbEnv(source: NodeJS.ProcessEnv = process.env): DbEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `Variáveis de ambiente de banco ausentes ou inválidas: ${missing}. Copie .env.example para .env.local.`,
    );
  }
  return parsed.data;
}
