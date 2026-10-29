import { useCallback, useEffect, useState } from "react";
import { MARITAL_STATUS_LABELS, type MaritalStatus } from "@corr/core/domain";
import { formatBRL, formatCpf } from "@corr/core/format";
import { api, type Config, type PessoaDaTela } from "@/src/api";
import { CHAVE_ULTIMA, chaveDaAba, type EstadoCaptura } from "@/src/captura-auto";

/**
 * O cliente do cadastro aberto no portal, com o que o sistema já tem dele.
 *
 * A pessoa é a do CPF da sessão de cadastro da aba (o mesmo que a captura
 * automática usa), e o quadro se atualiza a cada captura: o operador vê o
 * cadastro do sistema se completando enquanto avança nas telas do banco.
 */
export function ClienteDaTela({ config }: { config: Config }) {
  const [cpf, setCpf] = useState<string | null>(null);
  const [pessoa, setPessoa] = useState<PessoaDaTela | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);

  const lerCpf = useCallback(async () => {
    const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (aba?.id === undefined) return setCpf(null);
    const chave = chaveDaAba(aba.id);
    const estado = (await chrome.storage.session.get(chave))[chave] as EstadoCaptura | undefined;
    setCpf(estado?.cpf ?? null);
  }, []);

  const carregar = useCallback(async () => {
    if (!cpf) return setPessoa(undefined);
    try {
      setPessoa(await api.pessoaPorCpf(config, cpf));
      setErro(null);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Falha ao buscar o cadastro.");
    }
  }, [config, cpf]);

  useEffect(() => {
    void lerCpf();
    const aoMudarAba = () => void lerCpf();
    const aoMudarStorage = (mudancas: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "session") void lerCpf();
      // Captura concluída: o cadastro do sistema pode ter mudado.
      if (area === "local" && mudancas[CHAVE_ULTIMA]) void carregar();
    };
    chrome.tabs.onActivated.addListener(aoMudarAba);
    chrome.storage.onChanged.addListener(aoMudarStorage);
    return () => {
      chrome.tabs.onActivated.removeListener(aoMudarAba);
      chrome.storage.onChanged.removeListener(aoMudarStorage);
    };
  }, [lerCpf, carregar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!cpf) return null;

  return (
    <section className="bloco">
      <p className="rotulo">Cliente na tela</p>

      {pessoa === undefined ? <p className="discreto">Buscando o cadastro…</p> : null}

      {pessoa === null ? (
        <>
          <p className="destaque">CPF {formatCpf(cpf)}</p>
          <p className="discreto">
            Ainda sem cadastro no sistema. Ele é criado assim que a tela de dados cadastrais tiver o
            nome, junto com o cônjuge, se houver.
          </p>
        </>
      ) : null}

      {pessoa ? <Cadastro pessoa={pessoa} config={config} /> : null}

      {erro ? <p className="erro">{erro}</p> : null}
    </section>
  );
}

function Cadastro({ pessoa, config }: { pessoa: PessoaDaTela; config: Config }) {
  const estadoCivil = pessoa.maritalStatus
    ? MARITAL_STATUS_LABELS[pessoa.maritalStatus as MaritalStatus]
    : null;
  const despesas = [pessoa.rentCents, pessoa.condoFeeCents, pessoa.alimonyCents].reduce<number>(
    (soma, valor) => soma + (valor ?? 0),
    0,
  );

  const linhas: [string, string | null][] = [
    ["CPF", formatCpf(pessoa.cpf)],
    ["Nascimento", pessoa.birthDate ? pessoa.birthDate.split("-").reverse().join("/") : null],
    ["Mãe", pessoa.motherName],
    ["Estado civil", estadoCivil],
    ["Cônjuge", pessoa.spouseName],
    ["Cidade", pessoa.city ? `${pessoa.city}${pessoa.uf ? `/${pessoa.uf}` : ""}` : null],
    ["E-mail", pessoa.email],
    ["Telefone", pessoa.phone],
    ["Dependentes", pessoa.dependentsCount === null ? null : String(pessoa.dependentsCount)],
    ["Despesas mensais", despesas > 0 ? formatBRL(despesas) : null],
    [
      "Agência",
      pessoa.relationshipAgencyNumber
        ? [pessoa.relationshipAgencyNumber, pessoa.relationshipAgencyCity, pessoa.relationshipAgencyUf]
            .filter(Boolean)
            .join(" · ")
        : null,
    ],
  ];

  return (
    <>
      <p className="destaque">{pessoa.fullName}</p>

      <dl className="ficha">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt>{rotulo}</dt>
            <dd className={valor ? undefined : "discreto"}>{valor ?? "—"}</dd>
          </div>
        ))}
      </dl>

      {pessoa.incomes.length > 0 ? (
        <ul className="ficha-lista">
          {pessoa.incomes.map((renda, indice) => (
            <li key={indice}>
              Renda {renda.kind}: {renda.sourceName ?? "sem fonte"} ·{" "}
              {formatBRL(renda.grossCents ?? renda.netCents)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="discreto">Nenhuma renda cadastrada.</p>
      )}

      <p className="discreto">
        {pessoa.processes.length === 0
          ? "Sem processo aberto."
          : `Processo(s): ${pessoa.processes.map((processo) => `#${processo.number}`).join(", ")}`}
      </p>

      <button
        type="button"
        className="link"
        onClick={() => void chrome.tabs.create({ url: `${config.baseUrl}/pessoas/${pessoa.id}` })}
      >
        Abrir o cadastro no sistema
      </button>
    </>
  );
}
