/**
 * `fetch` para o cliente Supabase do servidor com prazo curto de conexão.
 *
 * Sem prazo, quando o Supabase local some (Docker parado ou com a VM pausada
 * pelo Resource Saver depois de dias ocioso) cada requisição ficava pendurada
 * ~25s até o undici desistir com `fetch failed`. Com o prazo, o middleware
 * recebe o `AuthRetryableFetchError` em poucos segundos e responde 503.
 *
 * O prazo só vale para chamadas sem `signal` próprio, para não atropelar
 * uploads/consultas longas que já controlam o cancelamento.
 */
const PRAZO_MS = 8_000;

export const fetchComTimeout: typeof fetch = (input, init) => {
  if (init?.signal) return fetch(input, init);
  return fetch(input, { ...init, signal: AbortSignal.timeout(PRAZO_MS) });
};
