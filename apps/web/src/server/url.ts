import "server-only";

import { headers } from "next/headers";

/**
 * Endereço do sistema para montar links que saem dele (portal do cliente,
 * convite da equipe).
 *
 * Em produção vale `APP_URL` (ex.: https://sistema.escritorio.com.br): o
 * cabeçalho Host vem de quem fez a requisição e não deve decidir para onde o
 * link aponta. Sem a variável (desenvolvimento), usa a origem da requisição.
 */
export async function enderecoDoSistema(): Promise<string> {
  const fixo = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (fixo) return fixo;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
