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
import type { PanelRequest, PanelResponse } from "@/src/messages";

/** Conversa com o content script da aba ativa. */
async function pedirAPagina(request: PanelRequest): Promise<PanelResponse> {
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!aba?.id) return { kind: "erro", message: "Nenhuma aba aberta." };

  try {
    return await chrome.tabs.sendMessage(aba.id, request);
  } catch {
    return {
      kind: "erro",
      message: "Abra a tela do portal do banco nesta aba para a extensão agir.",
    };
  }
}

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
    return <Conexao erro={erro} aoConectar={(novo, nome) => {
      setConfig(novo);
      setOrg(nome);
      setErro(null);
      void api.perfil(novo).then(setPerfil).catch(() => setPerfil(null));
    }} />;
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
          onClick={() => void limparConfig().then(() => { setConfig(null); setOrg(null); })}
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

      <button type="button" className="primario" disabled={testando || !token} onClick={() => void conectar()}>
        {testando ? "Conectando…" : "Conectar"}
      </button>
    </div>
  );
}

function Trabalho({ config, perfil }: { config: Config; perfil: PortalProfile }) {
  const [busca, setBusca] = useState("");
  const [processos, setProcessos] = useState<ProcessoResumo[]>([]);
  const [selecionado, setSelecionado] = useState<DadosDoProcesso | null>(null);
  const [tela, setTela] = useState<{ key: string | null; label: string | null }>({
    key: null,
    label: null,
  });
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semSobrescrever, setSemSobrescrever] = useState(true);

  const reconhecer = useCallback(async () => {
    const resposta = await pedirAPagina({ kind: "reconhecer", profile: perfil });
    if (resposta.kind === "reconhecido") {
      setTela({ key: resposta.screenKey, label: resposta.screenLabel });
      setErro(resposta.screenKey ? null : "Tela do portal ainda não mapeada.");
    } else if (resposta.kind === "erro") {
      setErro(resposta.message);
      setTela({ key: null, label: null });
    }
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

  async function preencher() {
    if (!selecionado) return;
    setErro(null);

    const resposta = await pedirAPagina({
      kind: "preencher",
      profile: perfil,
      values: selecionado.values,
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
    if (!selecionado) return;
    setErro(null);

    const resposta = await pedirAPagina({ kind: "capturar", profile: perfil });
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
        <p className="rotulo">Tela aberta</p>
        <p className={tela.key ? "destaque" : "discreto"}>
          {tela.label ?? "Nenhuma tela reconhecida"}
        </p>
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
          {processos.length === 0 ? <li className="discreto">Nenhum processo encontrado.</li> : null}
        </ul>
      </section>

      {selecionado ? (
        <section className="bloco">
          <p className="rotulo">Selecionado</p>
          <p className="destaque">
            #{selecionado.number} {selecionado.personName}
          </p>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={semSobrescrever}
              onChange={(e) => setSemSobrescrever(e.target.checked)}
            />
            Não sobrescrever campos já preenchidos
          </label>

          <div className="acoes">
            <button type="button" className="primario" disabled={!tela.key} onClick={() => void preencher()}>
              Preencher a tela
            </button>
            <button type="button" disabled={!tela.key} onClick={() => void capturar()}>
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
