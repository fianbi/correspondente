import { useCallback, useEffect, useState } from "react";
import { MARITAL_STATUS_LABELS, type MaritalStatus } from "@corr/core/domain";
import { formatBRL, formatCpf } from "@corr/core/format";
import type { PessoaDaTela } from "@/src/api";
import { chaveDaAba, type EstadoCaptura } from "@/src/captura-auto";

/**
 * CPF da sessão de cadastro da aba ativa: o mesmo que a coleta automática
 * usa para saber de quem é a tela aberta no portal.
 */
export function useCpfDaTela(): string | null {
  const [cpf, setCpf] = useState<string | null>(null);

  const ler = useCallback(async () => {
    const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (aba?.id === undefined) return setCpf(null);
    const chave = chaveDaAba(aba.id);
    const estado = (await chrome.storage.session.get(chave))[chave] as EstadoCaptura | undefined;
    setCpf(estado?.cpf ?? null);
  }, []);

  useEffect(() => {
    void ler();
    const aoMudarAba = () => void ler();
    const aoMudarStorage = (_: unknown, area: string) => {
      if (area === "session") void ler();
    };
    chrome.tabs.onActivated.addListener(aoMudarAba);
    chrome.storage.onChanged.addListener(aoMudarStorage);
    return () => {
      chrome.tabs.onActivated.removeListener(aoMudarAba);
      chrome.storage.onChanged.removeListener(aoMudarStorage);
    };
  }, [ler]);

  return cpf;
}

/** Iniciais para o avatar do cliente: "MARIA DA SILVA" vira "MS". */
export function iniciais(nome: string): string {
  const todas = nome.trim().split(/\s+/);
  // "DA", "DE", "DOS" não contam: as iniciais são as do nome e do sobrenome.
  const partes = todas.filter((parte) => parte.length > 2);
  const [primeira, ...resto] = partes.length > 0 ? partes : todas;
  return `${primeira?.[0] ?? ""}${resto.at(-1)?.[0] ?? ""}`.toUpperCase();
}

/** O que o sistema já tem do cliente, para conferir ao lado da tela do banco. */
export function Ficha({ pessoa }: { pessoa: PessoaDaTela }) {
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

  const preenchidos = linhas.filter(([, valor]) => valor !== null).length;

  return (
    <>
      <div className="progresso" title="Campos do resumo já preenchidos no sistema">
        <div style={{ width: `${Math.round((preenchidos / linhas.length) * 100)}%` }} />
      </div>
      <p className="discreto">
        {preenchidos} de {linhas.length} dados principais no sistema
      </p>

      <dl className="ficha">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt>{rotulo}</dt>
            <dd className={valor ? undefined : "discreto"}>{valor ?? "—"}</dd>
          </div>
        ))}
      </dl>

      <p className="rotulo">Rendas</p>
      {pessoa.incomes.length > 0 ? (
        <ul className="ficha-lista">
          {pessoa.incomes.map((renda, indice) => (
            <li key={indice}>
              <span className="etiqueta">{renda.kind}</span> {renda.sourceName ?? "sem fonte"} ·{" "}
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
    </>
  );
}
