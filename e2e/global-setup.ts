import { cleanupE2eData, e2eStartedAt } from "../packages/db/src/testing/e2e-cleanup";

const EMAIL = process.env.SEED_USER_EMAIL ?? "dev@correspondente.local";

/**
 * Marca o início da execução e devolve a limpeza, que o Playwright roda no fim
 * (passando ou falhando). Os processos e pessoas criados pelos testes saem do
 * escritório de dev, e o que o seed criou fica.
 */
export default async function globalSetup() {
  const desde = await e2eStartedAt();
  return async () => {
    await cleanupE2eData(EMAIL, desde);
  };
}
