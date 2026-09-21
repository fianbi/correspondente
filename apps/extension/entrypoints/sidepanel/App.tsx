import { useCallback, useEffect, useState } from "react";
import type { PortalProfile } from "@corr/portal";
import {
  api,
  gravarConfig,
  lerConfig,
  limparConfig,
  type Config,
  type DadosDoProcesso,
  type ProcessoResumo,
} from "@/src/api";
import { pedirAoQuadro, reconhecerPagina, type Reconhecimento } from "@/src/pagina";

export function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [org, setOrg] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<PortalProfile | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const guardado = await lerConfig();
      if (!guardado) return;
      setConfig(guardado);
      try {
        const sessao = await api.sessao(guardado);
        setOrg(sessao.orgName);
        setPerfil(await api.perfil(guardado));
      } catch (falha) {
        setErro(falha instanceof Error ? falha.message : "Falha ao conectar.");
      }
    })();
  }, []);

  if (!config || !org) {
    return (
      <Conexao
        erro={erro}
        aoConectar={(novo, nome) => {
          setConfig(novo);
          setOrg(nome);
          setErro(null);
          void api.perfil(novo).then(setPerfil).catch(() => setPerfil(null));
        }}
      />
    );
  }

  return (
    <div className="painel">
      <header className="cabecalho">
        <div>
          <strong>{org}</strong>
          <p className="discreto">Correspondente</p>
        </div>
        <button
          type="button"
          className="link"
          onClick={() =>
            void limparConfig().then(() => {
              setConfig(null);
              setOrg(null);
            })
          }
        >
          Desconectar
        </button>
      </header>

      {erro ? <p className="erro">{erro}</p> : null}

      {perfil ? (
        <Trabalho config={config} perfil={perfil} />
      ) : (
        <p className="discreto">Carregando o perfil do portal…</p>
      )}
    </div>
  );
}

function Conexao({
  erro,
  aoConectar,
}: {
  erro: string | null;
  aoConectar: (config: Config, orgName: string) => void;
}) {
  const [baseUrl, setBaseUrl] = useState("http://localhost:3000");
  const [token, setToken] = useState("");
  const [falha, setFalha] = useState<string | null>(erro);
  const [testando, setTestando] = useState(false);

  async function conectar() {
    setTestando(true);
    setFalha(null);
    const config = { baseUrl, token: token.trim() };
    try {
      const sessao = await api.sessao(config);
      await gravarConfig(config);
      aoConectar(config, sessao.orgName);
    } catch (e) {
      setFalha(e instanceof Error ? e.message : "Não foi possível conectar.");
    } finally {
      setTestando(false);
    }
  }

  return (
    <div className="painel">
      <h1>Conectar ao sistema</h1>
      <p className="discreto">
        Gere um token em Configurações → Escritório, no sistema, e cole aqui.
      </p>

      <label>
        Endereço do sistema
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
      </label>

      <label>
        Token
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="corr_…"
          type="password"
        />
      </label>

      {falha ? <p className="erro">{falha}</p> : null}

      <button
        type="button"
        className="primario"
        disabled={testando || !token}
        onClick={() => void conectar()}
      >
        {testando ? "Conectando…" : "Conectar"}
      </button>
    </div>
  );
}

function Trabalho({ config, perfil }: { config: Config; perfil: PortalProfile }) {
  const [busca, setBusca] = useState("");
  const [processos, setProcessos] = useState<ProcessoResumo[]>([]);
  const [selecionado, setSelecionado] = useState<DadosDoProcesso | null>(null);
  const [pagina, setPagina] = useState<Reconhecimento | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semSobrescrever, setSemSobrescrever] = useState(true);
  const [verDiagnostico, setVerDiagnostico] = useState(false);
  const [rendaEscolhida, setRendaEscolhida] = useState<string | null>(null);

  const reconhecer = useCallback(async () => {
    setPagina(await reconhecerPagina(perfil));
  }, [perfil]);

  useEffect(() => {
    void reconhecer();
    const ouvinte = () => void reconhecer();
    chrome.tabs.onActivated.addListener(ouvinte);
    chrome.tabs.onUpdated.addListener(ouvinte);
    return () => {
      chrome.tabs.onActivated.removeListener(ouvinte);
      chrome.tabs.onUpdated.removeListener(ouvinte);
    };
  }, [reconhecer]);

  useEffect(() => {
    void api.processos(config, busca).then(setProcessos).catch(() => setProcessos([]));
  }, [config, busca]);

  const telaPronta = pagina?.screen != null && pagina.frameId != null;

  // A tela de renda do portal cadastra uma fonte por vez: sem escolher qual,
  // preencher seria escrever a primeira da lista sem avisar o operador.
  const precisaDeRenda = pagina?.screen?.needsIncome === true;
  const rendas = selecionado?.incomes ?? [];
  const renda = rendas.find((item) => item.id === rendaEscolhida) ?? null;
  const faltaEscolherRenda = precisaDeRenda && renda === null;

  async function preencher() {
    if (!selecionado || !telaPronta || faltaEscolherRenda) return;
    setErro(null);

    const resposta = await pedirAoQuadro(pagina!.frameId!, {
      kind: "preencher",
      profile: perfil,
      screenKey: pagina!.screen!.key,
      values: { ...selecionado.values, ...(renda?.values ?? {}) },
      skipFilled: semSobrescrever,
    });

    if (resposta.kind === "preenchido") {
      const feitos = resposta.outcomes.filter((o) => o.status === "preenchido").length;
      const semOpcao = resposta.outcomes.filter((o) => o.status === "opcao_ausente").length;
      setResultado(
        `${feitos} campo(s) preenchido(s).` +
          (semOpcao > 0 ? ` ${semOpcao} sem opção equivalente — confira à mão.` : "") +
          " Confira e salve na tela do banco.",
      );
    } else if (resposta.kind === "erro") {
      setErro(resposta.message);
    }
  }

  async function capturar() {
    if (!selecionado || !telaPronta) return;
    setErro(null);

    const resposta = await pedirAoQuadro(pagina!.frameId!, {
      kind: "capturar",
      profile: perfil,
      screenKey: pagina!.screen!.key,
    });

    if (resposta.kind !== "capturado") {
      if (resposta.kind === "erro") setErro(resposta.message);
      return;
    }

    const valores = Object.fromEntries(resposta.values.map((v) => [v.dataKey, v.value]));
    try {
      const { applied } = await api.capturar(config, selecionado.processId, valores);
      setResultado(
        applied.length === 0
          ? "Nada novo: o cadastro já tinha esses dados."
          : `${applied.length} campo(s) trazido(s) para o cadastro.`,
      );
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Falha ao gravar.");
    }
  }

  return (
    <>
      <section className="bloco">
        <div className="linha">
          <p className="rotulo">Tela aberta</p>
          <button type="button" className="link" onClick={() => void reconhecer()}>
            Verificar de novo
          </button>
        </div>

        {telaPronta ? (
          <>
            <p className="destaque">{pagina!.screen!.label}</p>
            <p className="discreto">
              {pagina!.found} de {pagina!.total} campos do perfil encontrados nesta tela.
            </p>
          </>
        ) : (
          <>
            <p className="discreto">Nenhuma tela do perfil reconhecida.</p>
            <button
              type="button"
              className="link"
              onClick={() => setVerDiagnostico((v) => !v)}
            >
              {verDiagnostico ? "Ocultar detalhes" : "Ver o que foi encontrado"}
            </button>

            {/* O diagnóstico é o que transforma "não mapeada" em informação
                acionável: sem ele, não há como saber se o problema é a tela
                errada, um frame sem campos ou um perfil desatualizado. */}
            {verDiagnostico ? <Diagnostico pagina={pagina} perfil={perfil} /> : null}
          </>
        )}
      </section>

      <section className="bloco">
        <label>
          Processo
          <input
            value={busca}
            placeholder="Buscar por nome, CPF ou número"
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>

        <ul className="lista">
          {processos.map((processo) => (
            <li key={processo.id}>
              <button
                type="button"
                className={selecionado?.processId === processo.id ? "item selecionado" : "item"}
                onClick={() =>
                  void api
                    .dados(config, processo.id)
                    .then(setSelecionado)
                    .catch((e: Error) => setErro(e.message))
                }
              >
                <strong>#{processo.number}</strong> {processo.personName}
              </button>
            </li>
          ))}
          {processos.length === 0 ? (
            <li className="discreto">Nenhum processo encontrado.</li>
          ) : null}
        </ul>
      </section>

      {selecionado ? (
        <section className="bloco">
          <p className="rotulo">Selecionado</p>
          <p className="destaque">
            #{selecionado.number} {selecionado.personName}
          </p>

          {precisaDeRenda ? (
            <label>
              Renda a preencher
              <select
                value={rendaEscolhida ?? ""}
                onChange={(e) => setRendaEscolhida(e.target.value || null)}
              >
                <option value="">Selecione a fonte…</option>
                {rendas.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label} ({item.kind})
                  </option>
                ))}
              </select>
              {rendas.length === 0 ? (
                <span className="discreto">
                  Esta pessoa não tem renda cadastrada no sistema.
                </span>
              ) : null}
            </label>
          ) : null}

          <label className="checkbox">
            <input
              type="checkbox"
              checked={semSobrescrever}
              onChange={(e) => setSemSobrescrever(e.target.checked)}
            />
            Não sobrescrever campos já preenchidos
          </label>

          <div className="acoes">
            <button
              type="button"
              className="primario"
              disabled={!telaPronta || faltaEscolherRenda}
              onClick={() => void preencher()}
            >
              Preencher a tela
            </button>
            <button type="button" disabled={!telaPronta} onClick={() => void capturar()}>
              Trazer da tela
            </button>
          </div>

          <p className="discreto">
            A extensão nunca salva no portal: ela preenche, você confere e clica em salvar.
          </p>
        </section>
      ) : null}

      {resultado ? <p className="ok">{resultado}</p> : null}
      {erro ? <p className="erro">{erro}</p> : null}
    </>
  );
}

/** O que a extensão viu em cada frame da aba, para destravar o mapeamento. */
function Diagnostico({
  pagina,
  perfil,
}: {
  pagina: Reconhecimento | null;
  perfil: PortalProfile;
}) {
  const quadros = pagina?.quadros ?? [];

  if (quadros.length === 0) {
    return (
      <p className="discreto">
        Nenhum documento pôde ser lido nesta aba. A extensão só enxerga páginas em{" "}
        <code>{perfil.hostPattern}</code> — confira se a tela do portal está nesta aba e se o
        endereço bate.
      </p>
    );
  }

  return (
    <div className="diagnostico">
      {quadros.map((quadro) => (
        <div key={quadro.frameId} className="quadro">
          <p className="mono">{quadro.url}</p>
          <p className="discreto">
            {quadro.fieldNames.length} campo(s) visível(is)
            {quadro.hiddenCount > 0 ? ` e ${quadro.hiddenCount} de controle` : ""}
            {quadro.frameId !== 0 ? " · dentro de um frame" : ""}
          </p>
          {quadro.fieldNames.length > 0 ? (
            <p className="mono discreto">{quadro.fieldNames.join(", ")}</p>
          ) : null}
        </div>
      ))}

      <p className="discreto">
        Se os campos acima são os da tela que você quer preencher, o perfil precisa ser
        atualizado — mande esta lista para quem cuida do sistema.
      </p>
    </div>
  );
}
