import { CAIXA_PROFILE } from "@corr/portal";
import { listSiteMappings, saveSiteMapping } from "@corr/db";
import { contextFromRequest, json, preflight, unauthorized } from "../_auth";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * Perfil do portal: o embutido no código mais o que o escritório ensinou.
 *
 * O ensinado vem depois na lista e vence, porque quando o banco muda a tela o
 * escritório não pode ficar esperando uma nova versão da extensão.
 */
export async function GET(request: Request) {
  const ctx = await contextFromRequest(request);
  if (!ctx) return unauthorized(request);

  const aprendidos = await listSiteMappings(ctx, CAIXA_PROFILE.key);

  const screens = CAIXA_PROFILE.screens.map((screen) => {
    const extras = aprendidos
      .filter((mapping) => mapping.screenKey === screen.key)
      .map((mapping) => ({
        dataKey: mapping.dataKey,
        selector: mapping.selector,
        transform: mapping.transform ?? undefined,
      }));

    return { ...screen, mappings: [...screen.mappings, ...extras] };
  });

  return json(request, { ...CAIXA_PROFILE, screens });
}

/** Salva um campo ensinado pelo operador no modo de aprendizado. */
export async function POST(request: Request) {
  const ctx = await contextFromRequest(request);
  if (!ctx) return unauthorized(request);

  const body = (await request.json()) as {
    screenKey?: string;
    dataKey?: string;
    selector?: string;
    transform?: string | null;
  };

  if (!body.screenKey || !body.dataKey || !body.selector) {
    return json(request, { error: "Informe tela, dado e seletor." }, 400);
  }

  await saveSiteMapping(ctx, {
    portalKey: CAIXA_PROFILE.key,
    screenKey: body.screenKey,
    dataKey: body.dataKey,
    selector: body.selector,
    transform: body.transform ?? null,
  });

  return json(request, { ok: true });
}
