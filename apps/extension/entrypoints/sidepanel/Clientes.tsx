import { useEffect, useState } from "react";
import { formatCpf } from "@corr/core/format";
import { api, type ClienteResumo, type Config } from "@/src/api";
import { CHAVE_ULTIMA } from "@/src/captura-auto";
import { iniciais } from "./ClienteDaTela";

/** "há 5 min", "há 2 h", "ontem": a lista diz quem foi mexido por último. */
function haQuanto(quando: string): string {
  const minutos = Math.round((Date.now() - new Date(quando).getTime()) / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? "ontem" : new Date(quando).toLocaleDateString("pt-BR");
}

/**
 * Aba Clientes: os últimos cadastrados ou atualizados no escritório, com
 * busca por nome ou CPF. Escolher um leva para o atendimento dele.
 */
export function Clientes({
  config,
  cpfAtivo,
  cpfDaTela,
  aoEscolher,
}: {
  config: Config;
  cpfAtivo: string | null;
  cpfDaTela: string | null;
  aoEscolher: (cpf: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [clientes, setClientes] = useState<ClienteResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  // A coleta automática cria e atualiza cadastros: a lista acompanha.
  useEffect(() => {
    const ouvinte = (mudancas: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && mudancas[CHAVE_ULTIMA]) setVersao((v) => v + 1);
    };
    chrome.storage.onChanged.addListener(ouvinte);
    return () => chrome.storage.onChanged.removeListener(ouvinte);
  }, []);

  useEffect(() => {
    // Uma busca por tecla seria uma requisição por tecla: espera a pausa.
    const espera = setTimeout(() => {
      api
        .clientes(config, busca)
        .then((lista) => {
          setClientes(lista);
          setErro(null);
        })
        .catch((falha: Error) => setErro(falha.message));
    }, 300);
    return () => clearTimeout(espera);
  }, [config, busca, versao]);

  return (
    <section className="bloco">
      <input
        type="search"
        value={busca}
        placeholder="Buscar por nome ou CPF"
        aria-label="Buscar cliente"
        onChange={(e) => setBusca(e.target.value)}
      />

      <p className="rotulo">{busca.trim() ? "Resultado da busca" : "Últimos clientes"}</p>

      {erro ? <p className="erro">{erro}</p> : null}
      {clientes === null && !erro ? <p className="discreto">Carregando…</p> : null}
      {clientes?.length === 0 ? (
        <p className="discreto">
          {busca.trim()
            ? "Nenhum cliente encontrado."
            : "Nenhum cliente ainda. Eles aparecem aqui quando a coleta cria o cadastro."}
        </p>
      ) : null}

      <ul className="clientes">
        {clientes?.map((cliente) => (
          <li key={cliente.id}>
            <button
              type="button"
              className={cliente.cpf === cpfAtivo ? "cliente ativo" : "cliente"}
              onClick={() => aoEscolher(cliente.cpf)}
            >
              <span className="avatar">{iniciais(cliente.fullName)}</span>
              <span className="cliente-texto">
                <span className="cliente-nome">{cliente.fullName}</span>
                <span className="discreto">
                  {formatCpf(cliente.cpf)}
                  {cliente.city ? ` · ${cliente.city}${cliente.uf ? `/${cliente.uf}` : ""}` : ""}
                </span>
              </span>
              <span className="cliente-lado">
                {cliente.cpf === cpfDaTela ? <span className="selo ok">na tela</span> : null}
                <span className="discreto">{haQuanto(cliente.updatedAt)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
