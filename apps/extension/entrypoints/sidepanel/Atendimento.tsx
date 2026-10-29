import { useCallback, useEffect, useState } from "react";
import type { PortalProfile } from "@corr/portal";
import { formatCpf } from "@corr/core/format";
import { api, type Config, type DadosDoCliente, type PessoaDaTela } from "@/src/api";
import { CHAVE_ULTIMA } from "@/src/captura-auto";
import { pedirAoQuadro, type Reconhecimento } from "@/src/pagina";
import { UltimaColeta, type Coleta } from "./CapturaAutomatica";
import { Ficha, iniciais } from "./ClienteDaTela";

/**
 * Aba Atendimento: a tela do portal aberta agora e o cliente em atendimento,
 * com os botões de preencher a tela e trazer dela.
 *
 * O cliente é o do CPF da tela, a não ser que o operador tenha escolhido outro
 * na lista. Nesse caso os botões travam quando a tela já é de outro CPF:
 * escrever os dados de um cliente no cadastro de outro é o erro mais caro que
 * a extensão pode cometer.
 */
export function Atendimento({
  config,
  perfil,
  pagina,
  reconhecer,
  cpf,
  cpfDaTela,
  coleta,
  aoVoltarParaTela,
  aoAbrirClientes,
}: {
  config: Config;
  perfil: PortalProfile;
  pagina: Reconhecimento | null;
  reconhecer: () => Promise<void>;
  cpf: string | null;
  cpfDaTela: string | null;
  coleta: Coleta;
  aoVoltarParaTela: () => void;
  aoAbrirClientes: () => void;
}) {
  const [pessoa, setPessoa] = useState<PessoaDaTela | null | undefined>(undefined);
  const [dados, setDados] = useState<DadosDoCliente | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semSobrescrever, setSemSobrescrever] = useState(true);
  const [verDiagnostico, setVerDiagnostico] = useState(false);
  const [verFicha, setVerFicha] = useState(true);
  const [rendaEscolhida, setRendaEscolhida] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    if (!cpf) {
      setPessoa(undefined);
      setDados(null);
      return;
    }
    try {
      const encontrada = await api.pessoaPorCpf(config, cpf);
      setPessoa(encontrada);
      setDados(encontrada ? await api.dadosDoCliente(config, cpf) : null);
      setErro(null);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Falha ao buscar o cadastro.");
    }
  }, [config, cpf]);

  useEffect(() => {
    setPessoa(undefined);
    setResultado(null);
    setRendaEscolhida(null);
    void carregar();
  }, [carregar]);

  // Coleta concluída: o cadastro do sistema pode ter mudado.
  useEffect(() => {
    const ouvinte = (mudancas: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && mudancas[CHAVE_ULTIMA]) void carregar();
    };
    chrome.storage.onChanged.addListener(ouvinte);
    return () => chrome.storage.onChanged.removeListener(ouvinte);
  }, [carregar]);

  const telaPronta = pagina?.screen != null && pagina.frameId != null;
  const daTela = cpf !== null && cpf === cpfDaTela;
  const outroNaTela = cpf !== null && cpfDaTela !== null && cpf !== cpfDaTela;

  // A tela de renda do portal cadastra uma fonte por vez: sem escolher qual,
  // preencher seria escrever a primeira da lista sem avisar o operador.
  const precisaDeRenda = pagina?.screen?.needsIncome === true;
  const rendas = dados?.incomes ?? [];
  const renda = rendas.find((item) => item.id === rendaEscolhida) ?? null;
  const faltaEscolherRenda = precisaDeRenda && renda === null;

  const podePreencher = telaPronta && dados !== null && !outroNaTela && !faltaEscolherRenda;
  const podeTrazer = telaPronta && cpf !== null && !outroNaTela;

  async function preencher() {
    if (!podePreencher || !cpf) return;
    setErro(null);
    setResultado(null);
    setOcupado(true);
    try {
      // Os dados vêm de novo na hora: o cadastro pode ter mudado na web.
      const atuais = await api.dadosDoCliente(config, cpf);
      setDados(atuais);
      const escolhida = atuais.incomes.find((item) => item.id === rendaEscolhida) ?? null;

      const resposta = await pedirAoQuadro(pagina!.frameId!, {
        kind: "preencher",
        profile: perfil,
        screenKey: pagina!.screen!.key,
        values: { ...atuais.values, ...(escolhida?.values ?? {}) },
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
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Falha ao preencher.");
    } finally {
      setOcupado(false);
    }
  }

  async function trazer() {
    if (!podeTrazer || !cpf) return;
    setErro(null);
    setResultado(null);
    setOcupado(true);
    try {
      const resposta = await pedirAoQuadro(pagina!.frameId!, {
        kind: "capturar",
        profile: perfil,
        screenKey: pagina!.screen!.key,
      });
      if (resposta.kind !== "capturado") {
        if (resposta.kind === "erro") setErro(resposta.message);
        return;
      }

      const valores = Object.fromEntries(
        resposta.values
          .filter((v): v is { dataKey: string; value: string } => v.value !== null && v.value !== "")
          .map((v) => [v.dataKey, v.value]),
      );
      const { found, applied, created } = await api.capturarPorCpf(config, {
        cpf,
        screenKey: pagina!.screen!.key,
        values: valores,
        incomes: [],
      });
      setResultado(
        !found
          ? "Este CPF ainda não tem cadastro, e a tela não traz o nome para criar."
          : created
            ? "Cadastro criado com os dados da tela."
            : applied.length === 0
              ? "Nada novo: o cadastro já tinha esses dados."
              : `${applied.length} campo(s) trazido(s) para o cadastro.`,
      );
      await carregar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Falha ao gravar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <section className="bloco">
        <div className="linha">
          <p className="rotulo">Tela do portal</p>
          <button type="button" className="link" onClick={() => void reconhecer()}>
            Verificar de novo
          </button>
        </div>

        {telaPronta ? (
          <div className="tela-status">
            <span className="ponto ok" aria-hidden="true" />
            <div>
              <p className="destaque">{pagina!.screen!.label}</p>
              <p className="discreto">
                {pagina!.found} de {pagina!.total} campos do perfil encontrados
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="tela-status">
              <span className="ponto" aria-hidden="true" />
              <p className="discreto">Nenhuma tela do cadastro reconhecida nesta aba.</p>
            </div>
            <button type="button" className="link" onClick={() => setVerDiagnostico((v) => !v)}>
              {verDiagnostico ? "Ocultar detalhes" : "Ver o que foi encontrado"}
            </button>
            {/* O diagnóstico é o que transforma "não mapeada" em informação
                acionável: sem ele, não há como saber se o problema é a tela
                errada, um frame sem campos ou um perfil desatualizado. */}
            {verDiagnostico ? <Diagnostico pagina={pagina} perfil={perfil} /> : null}
          </>
        )}
      </section>

      {cpf === null ? (
        <section className="bloco vazio">
          <p className="destaque">Nenhum cliente em atendimento</p>
          <p className="discreto">
            Digite o CPF na tela de abertura do cadastro no portal, ou escolha um cliente na lista.
          </p>
          <button type="button" onClick={aoAbrirClientes}>
            Ver últimos clientes
          </button>
        </section>
      ) : (
        <section className="bloco">
          <div className="linha">
            <p className="rotulo">{daTela ? "Cliente na tela" : "Cliente escolhido"}</p>
            {!daTela && cpfDaTela ? (
              <button type="button" className="link" onClick={aoVoltarParaTela}>
                Usar o cliente da tela
              </button>
            ) : null}
          </div>

          <div className="cliente-topo">
            <span className="avatar grande">{pessoa ? iniciais(pessoa.fullName) : "?"}</span>
            <div>
              <p className="destaque">{pessoa?.fullName ?? `CPF ${formatCpf(cpf)}`}</p>
              <p className="discreto">
                {pessoa ? formatCpf(pessoa.cpf) : pessoa === null ? "Ainda sem cadastro" : "Buscando…"}
              </p>
            </div>
          </div>

          {pessoa === null ? (
            <p className="discreto">
              O cadastro é criado assim que a tela de dados cadastrais tiver o nome, junto com o
              cônjuge, se houver.
            </p>
          ) : null}

          {outroNaTela ? (
            <p className="aviso">
              A tela do portal é de outro cliente (CPF final {cpfDaTela!.slice(-4)}). Para não
              misturar cadastros, preencher e trazer ficam travados.
            </p>
          ) : null}

          {precisaDeRenda && pessoa ? (
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
                <span className="discreto">Este cliente não tem renda cadastrada no sistema.</span>
              ) : null}
            </label>
          ) : null}

          <div className="acoes">
            <button
              type="button"
              className="primario"
              disabled={!podePreencher || ocupado}
              onClick={() => void preencher()}
            >
              Preencher esta tela
            </button>
            <button type="button" disabled={!podeTrazer || ocupado} onClick={() => void trazer()}>
              Trazer da tela
            </button>
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={semSobrescrever}
              onChange={(e) => setSemSobrescrever(e.target.checked)}
            />
            Não sobrescrever campos já preenchidos no portal
          </label>

          {!telaPronta ? (
            <p className="discreto">Abra uma tela do cadastro no portal para preencher.</p>
          ) : null}

          {resultado ? <p className="ok">{resultado}</p> : null}
          {erro ? <p className="erro">{erro}</p> : null}

          {daTela && coleta.ultima?.cpfFinal === cpf.slice(-4) ? (
            <UltimaColeta ultima={coleta.ultima} perfil={perfil} />
          ) : null}

          {pessoa ? (
            <>
              <div className="linha">
                <button type="button" className="link" onClick={() => setVerFicha((v) => !v)}>
                  {verFicha ? "Ocultar cadastro" : "Ver cadastro"}
                </button>
                <button
                  type="button"
                  className="link"
                  onClick={() =>
                    void chrome.tabs.create({ url: `${config.baseUrl}/pessoas/${pessoa.id}` })
                  }
                >
                  Abrir no sistema ↗
                </button>
              </div>
              {verFicha ? <Ficha pessoa={pessoa} /> : null}
            </>
          ) : null}

          <p className="discreto">
            A extensão nunca salva no portal: ela preenche, você confere e clica em salvar.
          </p>
        </section>
      )}
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
