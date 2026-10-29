import { useCallback, useEffect, useState } from "react";
import type { PortalProfile } from "@corr/portal";
import {
  api,
  ENDERECO_PADRAO,
  gravarConfig,
  lerConfig,
  SessaoExpirada,
  type Config,
  type Sessao,
} from "@/src/api";
import { CHAVE_PERFIL } from "@/src/captura-auto";
import { reconhecerPagina, type Reconhecimento } from "@/src/pagina";
import { Atendimento } from "./Atendimento";
import { Atividade, ChaveDaColeta, useColeta, type Coleta } from "./CapturaAutomatica";
import { useCpfDaTela } from "./ClienteDaTela";
import { Clientes } from "./Clientes";

export function App() {
  const [config, setConfig] = useState<Config>({ baseUrl: ENDERECO_PADRAO });
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [perfil, setPerfil] = useState<PortalProfile | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const coleta = useColeta();

  // A sessão é a da web: o painel só confere se ela existe e com quem está.
  const conectar = useCallback(async (atual: Config) => {
    setErro(null);
    try {
      const confirmada = await api.sessao(atual);
      setSessao(confirmada);
      setPerfil(await api.perfil(atual));
    } catch (falha) {
      setSessao(null);
      setPerfil(null);
      if (!(falha instanceof SessaoExpirada)) {
        setErro(falha instanceof Error ? falha.message : "Falha ao conectar.");
      }
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const guardado = await lerConfig();
      setConfig(guardado);
      await conectar(guardado);
      setCarregando(false);
    })();
  }, [conectar]);

  // Quem acabou de entrar (ou trocar de usuário/escritório) na web volta ao
  // painel e já encontra a sessão nova, sem precisar clicar em nada.
  useEffect(() => {
    const aoFocar = () => void conectar(config);
    window.addEventListener("focus", aoFocar);
    return () => window.removeEventListener("focus", aoFocar);
  }, [conectar, config]);

  if (carregando) return <p className="painel discreto">Carregando…</p>;

  if (!sessao) {
    return (
      <Desconectado
        config={config}
        erro={erro}
        aoTentar={async (novo) => {
          await gravarConfig(novo);
          setConfig(novo);
          await conectar(novo);
        }}
      />
    );
  }

  return (
    <div className="painel">
      <header className="cabecalho">
        <div className="marca">
          <span className="logo" aria-hidden="true">C</span>
          <div>
            <strong>{sessao.orgName}</strong>
            <p className="discreto" title="Para trocar de usuário ou escritório, use o sistema.">
              {sessao.email}
            </p>
          </div>
        </div>
        {/* A versão vem do package.json da extensão; cada build que vai para
            o operador sobe um número, e é por ela que se confere se o Chrome
            carregou o build certo. */}
        <span className="selo" title="Versão da extensão">
          v{chrome.runtime.getManifest().version}
        </span>
      </header>

      <ChaveDaColeta coleta={coleta} />

      {erro ? <p className="erro">{erro}</p> : null}

      {perfil ? (
        // A chave zera o trabalho ao trocar de usuário ou escritório na web:
        // cliente escolhido num escritório não pode ser preenchido no outro.
        <Trabalho
          key={`${sessao.email}:${sessao.orgId}`}
          config={config}
          perfil={perfil}
          coleta={coleta}
        />
      ) : (
        <p className="discreto">Carregando o perfil do portal…</p>
      )}

      <footer className="rodape">
        <button
          type="button"
          className="link"
          onClick={() => void chrome.tabs.create({ url: config.baseUrl })}
        >
          Abrir o sistema ↗
        </button>
        <span className="discreto">Trocar usuário ou escritório: no sistema</span>
      </footer>
    </div>
  );
}

function Desconectado({
  config,
  erro,
  aoTentar,
}: {
  config: Config;
  erro: string | null;
  aoTentar: (config: Config) => Promise<void>;
}) {
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [tentando, setTentando] = useState(false);

  async function tentar() {
    setTentando(true);
    try {
      await aoTentar({ baseUrl });
    } finally {
      setTentando(false);
    }
  }

  return (
    <div className="painel">
      <h1>Você não está conectado ao sistema</h1>
      <p className="discreto">
        A extensão usa o login do sistema neste navegador. Entre no sistema e volte aqui.
      </p>

      <label>
        Endereço do sistema
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
      </label>

      {erro ? <p className="erro">{erro}</p> : null}

      <button
        type="button"
        className="primario"
        onClick={() => void chrome.tabs.create({ url: `${baseUrl.trim().replace(/\/$/, "")}/login` })}
      >
        Abrir o sistema
      </button>
      <button type="button" disabled={tentando} onClick={() => void tentar()}>
        {tentando ? "Conferindo…" : "Já entrei, tentar de novo"}
      </button>
    </div>
  );
}

type Aba = "atendimento" | "clientes" | "atividade";

function Trabalho({
  config,
  perfil,
  coleta,
}: {
  config: Config;
  perfil: PortalProfile;
  coleta: Coleta;
}) {
  const [aba, setAba] = useState<Aba>("atendimento");
  const [pagina, setPagina] = useState<Reconhecimento | null>(null);
  const cpfDaTela = useCpfDaTela();
  // Cliente escolhido na lista; sem escolha, o atendimento segue a tela.
  const [escolhido, setEscolhido] = useState<string | null>(null);

  // O content script reconhece as telas com este perfil, que inclui o que o
  // escritório ensinou; antes de o painel abrir, ele usa o perfil de fábrica.
  useEffect(() => {
    void chrome.storage.local.set({ [CHAVE_PERFIL]: perfil });
  }, [perfil]);

  // Um CPF novo digitado no portal é um atendimento novo: a escolha antiga
  // da lista deixa de valer e o painel passa a seguir a tela.
  useEffect(() => {
    if (cpfDaTela) setEscolhido(null);
  }, [cpfDaTela]);

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

  const cpf = escolhido ?? cpfDaTela;

  const abas: [Aba, string][] = [
    ["atendimento", "Atendimento"],
    ["clientes", "Clientes"],
    ["atividade", "Atividade"],
  ];

  return (
    <>
      <nav className="abas" role="tablist">
        {abas.map(([chave, rotulo]) => (
          <button
            key={chave}
            type="button"
            role="tab"
            aria-selected={aba === chave}
            className={aba === chave ? "aba ativa" : "aba"}
            onClick={() => setAba(chave)}
          >
            {rotulo}
            {chave === "atividade" && coleta.ultima?.erro ? <span className="ponto erro" /> : null}
          </button>
        ))}
      </nav>

      {aba === "atendimento" ? (
        <Atendimento
          config={config}
          perfil={perfil}
          pagina={pagina}
          reconhecer={reconhecer}
          cpf={cpf}
          cpfDaTela={cpfDaTela}
          coleta={coleta}
          aoVoltarParaTela={() => setEscolhido(null)}
          aoAbrirClientes={() => setAba("clientes")}
        />
      ) : null}

      {aba === "clientes" ? (
        <Clientes
          config={config}
          cpfAtivo={cpf}
          cpfDaTela={cpfDaTela}
          aoEscolher={(escolha) => {
            setEscolhido(escolha === cpfDaTela ? null : escolha);
            setAba("atendimento");
          }}
        />
      ) : null}

      {aba === "atividade" ? <Atividade coleta={coleta} perfil={perfil} /> : null}
    </>
  );
}
