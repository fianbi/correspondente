import { useEffect, useState } from "react";
import type { PortalProfile } from "@corr/portal";
import {
  CHAVE_DESLIGADA,
  CHAVE_DIAGNOSTICO,
  CHAVE_ULTIMA,
  type Diagnostico,
  type UltimaCaptura,
} from "@/src/captura-auto";

export interface Coleta {
  ligada: boolean;
  alternar: (valor: boolean) => Promise<void>;
  ultima: UltimaCaptura | null;
  leituras: Diagnostico[];
}

/**
 * Situação da coleta automática: se está ligada, o último envio e as últimas
 * leituras. Sem isto, a coleta seria invisível — o operador não teria como
 * saber se a tela que acabou de salvar chegou ao sistema.
 */
export function useColeta(): Coleta {
  const [ligada, setLigada] = useState(true);
  const [ultima, setUltima] = useState<UltimaCaptura | null>(null);
  const [leituras, setLeituras] = useState<Diagnostico[]>([]);

  useEffect(() => {
    void chrome.storage.local
      .get([CHAVE_DESLIGADA, CHAVE_ULTIMA, CHAVE_DIAGNOSTICO])
      .then((guardado) => {
        setLigada(!guardado[CHAVE_DESLIGADA]);
        setUltima((guardado[CHAVE_ULTIMA] as UltimaCaptura | undefined) ?? null);
        setLeituras((guardado[CHAVE_DIAGNOSTICO] as Diagnostico[] | undefined) ?? []);
      });

    const ouvinte = (mudancas: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local") return;
      if (mudancas[CHAVE_DESLIGADA]) setLigada(!mudancas[CHAVE_DESLIGADA].newValue);
      if (mudancas[CHAVE_ULTIMA]) {
        setUltima((mudancas[CHAVE_ULTIMA].newValue as UltimaCaptura | undefined) ?? null);
      }
      if (mudancas[CHAVE_DIAGNOSTICO]) {
        setLeituras((mudancas[CHAVE_DIAGNOSTICO].newValue as Diagnostico[] | undefined) ?? []);
      }
    };
    chrome.storage.onChanged.addListener(ouvinte);
    return () => chrome.storage.onChanged.removeListener(ouvinte);
  }, []);

  async function alternar(valor: boolean) {
    setLigada(valor);
    if (valor) await chrome.storage.local.remove(CHAVE_DESLIGADA);
    else await chrome.storage.local.set({ [CHAVE_DESLIGADA]: true });
  }

  return { ligada, alternar, ultima, leituras };
}

/** Chave liga/desliga do cabeçalho: está sempre à vista, em qualquer aba. */
export function ChaveDaColeta({ coleta }: { coleta: Coleta }) {
  return (
    <label className="chave" title="Grava no sistema o que for salvo nas telas do portal">
      <input
        type="checkbox"
        role="switch"
        checked={coleta.ligada}
        onChange={(e) => void coleta.alternar(e.target.checked)}
      />
      <span className="chave-trilho" aria-hidden="true" />
      <span>Coleta automática {coleta.ligada ? "ligada" : "desligada"}</span>
    </label>
  );
}

/** Uma linha sobre o último envio, para o cartão do cliente e a aba Atividade. */
export function UltimaColeta({
  ultima,
  perfil,
}: {
  ultima: UltimaCaptura;
  perfil: PortalProfile;
}) {
  const tela = perfil.screens.find((screen) => screen.key === ultima.screenKey);
  return (
    <p className={ultima.erro ? "erro" : "nota"}>
      <strong>{new Date(ultima.em).toLocaleTimeString("pt-BR")}</strong> ·{" "}
      {tela?.label ?? ultima.screenKey} · CPF final {ultima.cpfFinal}:{" "}
      {ultima.erro ?? descrever(ultima)}
    </p>
  );
}

/** Aba Atividade: o que a coleta automática leu e o que fez com cada leitura. */
export function Atividade({ coleta, perfil }: { coleta: Coleta; perfil: PortalProfile }) {
  const { ligada, ultima, leituras } = coleta;

  return (
    <>
      <section className="bloco">
        <p className="rotulo">Como funciona</p>
        <p className="discreto">
          {ligada
            ? "Ao salvar ou sair de uma tela do cadastro no portal, a extensão lê os campos e grava no cadastro do CPF digitado na abertura do cadastro. Só campos vazios no sistema são preenchidos."
            : "A coleta está desligada: nada do que for salvo no portal vai para o sistema. Ligue a chave no topo do painel para voltar a gravar."}
        </p>
      </section>

      <section className="bloco">
        <p className="rotulo">Último envio</p>
        {ultima ? (
          <UltimaColeta ultima={ultima} perfil={perfil} />
        ) : (
          <p className="discreto">Nenhum envio ainda.</p>
        )}
      </section>

      <section className="bloco">
        <p className="rotulo">Últimas leituras ({leituras.length})</p>
        {leituras.length === 0 ? (
          <p className="discreto">
            Nenhuma leitura ainda. Se você já passou por telas do cadastro, recarregue a aba do
            portal: o script da extensão só entra em páginas abertas depois de ela ser carregada.
          </p>
        ) : (
          <ul className="linha-do-tempo">
            {leituras.map((leitura) => (
              <li key={`${leitura.em}-${leitura.momento}`}>
                <span className="hora">{new Date(leitura.em).toLocaleTimeString("pt-BR")}</span>
                <span>
                  <strong>
                    {perfil.screens.find((s) => s.key === leitura.screenKey)?.label ??
                      leitura.screenKey ??
                      "Sem tela reconhecida"}
                  </strong>{" "}
                  <span className="discreto">
                    ({leitura.momento}
                    {leitura.cpfFinal ? ` · CPF final ${leitura.cpfFinal}` : ""})
                  </span>
                  <br />
                  {leitura.resultado}
                  {leitura.url && !leitura.screenKey ? (
                    <span className="mono discreto"> ({leitura.url})</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function descrever(ultima: UltimaCaptura): string {
  const partes: string[] = [];
  if (ultima.created) partes.push("cadastro criado");
  if (ultima.spouseCreated) partes.push("cônjuge cadastrado");
  if (ultima.applied.length > 0) partes.push(`${ultima.applied.length} campo(s)`);
  if (ultima.incomesAdded) partes.push(`${ultima.incomesAdded} renda(s)`);
  const resumo =
    partes.length === 0 ? "nada novo para o cadastro." : `${partes.join(" e ")} trazido(s).`;
  const ignorados = ultima.ignored ?? [];
  return ignorados.length === 0
    ? resumo
    : `${resumo} Não aceitos pelo cadastro: ${ignorados.map((chave) => chave.replace("person.", "")).join(", ")}.`;
}
