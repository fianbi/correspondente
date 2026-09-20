import { listProcesses } from "@corr/db";
import { contextFromRequest, json, preflight, unauthorized } from "../_auth";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/** Processos ativos, para a extensão escolher com quem está trabalhando. */
export async function GET(request: Request) {
  const ctx = await contextFromRequest(request);
  if (!ctx) return unauthorized(request);

  const busca = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const processos = await listProcesses(ctx);

  const filtrados = busca
    ? processos.filter(
        (processo) =>
          processo.personName.toLowerCase().includes(busca) ||
          processo.personCpf.includes(busca.replace(/\D+/g, "")) ||
          String(processo.number) === busca,
      )
    : processos;

  return json(
    request,
    filtrados.slice(0, 50).map((processo) => ({
      id: processo.id,
      number: processo.number,
      personName: processo.personName,
      personCpf: processo.personCpf,
      stage: processo.stage,
      status: processo.status,
    })),
  );
}
