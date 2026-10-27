import { useEffect, useState } from "react";
import type { PortalProfile } from "@corr/portal";
import { CHAVE_DESLIGADA, CHAVE_PERFIL, CHAVE_ULTIMA, type UltimaCaptura } from "@/src/captura-auto";

/**
 * Situação da captura automática: se está ligada e o que aconteceu no último
 * envio. Sem isto, a captura seria invisível — o operador não teria como
 * saber se a tela que acabou de salvar chegou ao sistema.
 */
export function CapturaAutomatica({ perfil }: { perfil: PortalProfile }) {
  const [ligada, setLigada] = useState(true);
  const [ultima, setUltima] = useState<UltimaCaptura | null>(null);

  // O content script reconhece as telas com este perfil, que inclui o que o
  // escritório ensinou; antes de o painel abrir, ele usa o perfil de fábrica.
  useEffect(() => {
    void chrome.storage.local.set({ [CHAVE_PERFIL]: perfil });
  }, [perfil]);

  useEffect(() => {
    void chrome.storage.local.get([CHAVE_DESLIGADA, CHAVE_ULTIMA]).then((guardado) => {
      setLigada(!guardado[CHAVE_DESLIGADA]);
      setUltima((guardado[CHAVE_ULTIMA] as UltimaCaptura | undefined) ?? null);
    });

    const ouvinte = (mudancas: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local" || !mudancas[CHAVE_ULTIMA]) return;
      setUltima((mudancas[CHAVE_ULTIMA].newValue as UltimaCaptura | undefined) ?? null);
    };
    chrome.storage.onChanged.addListener(ouvinte);
    return () => chrome.storage.onChanged.removeListener(ouvinte);
  }, []);

  async function alternar(valor: boolean) {
    setLigada(valor);
    if (valor) await chrome.storage.local.remove(CHAVE_DESLIGADA);
    else await chrome.storage.local.set({ [CHAVE_DESLIGADA]: true });
  }

  const tela = perfil.screens.find((screen) => screen.key === ultima?.screenKey);

  return (
    <section className="bloco">
      <label className="checkbox">
        <input type="checkbox" checked={ligada} onChange={(e) => void alternar(e.target.checked)} />
        Trazer da tela automaticamente ao salvar no portal
      </label>
      <p className="discreto">
        A pessoa é a do CPF digitado na abertura do cadastro. Só campos vazios no sistema são
        preenchidos.
      </p>

      {ultima ? (
        <p className={ultima.erro ? "erro" : "discreto"}>
          {new Date(ultima.em).toLocaleTimeString("pt-BR")} · {tela?.label ?? ultima.screenKey} ·
          CPF final {ultima.cpfFinal}:{" "}
          {ultima.erro ?? descrever(ultima)}
        </p>
      ) : null}
    </section>
  );
}

function descrever(ultima: UltimaCaptura): string {
  const partes: string[] = [];
  if (ultima.applied.length > 0) partes.push(`${ultima.applied.length} campo(s)`);
  if (ultima.incomesAdded) partes.push(`${ultima.incomesAdded} renda(s)`);
  return partes.length === 0 ? "nada novo para o cadastro." : `${partes.join(" e ")} trazido(s).`;
}
