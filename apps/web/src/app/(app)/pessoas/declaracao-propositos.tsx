"use client";

import { useState } from "react";

type Proposito =
  | "purposeAccounts"
  | "purposeLoans"
  | "purposeInvestments"
  | "purposeCreditCard"
  | "purposeInsurance"
  | "purposeForeignExchange";

export type Propositos = Record<Proposito | "purposeHousingLoan", boolean | null>;

/** Na ordem e com os textos da tela do SICAQ. */
const CAIXAS: [Proposito, string][] = [
  ["purposeAccounts", "Movimentação de conta, depósito e poupança"],
  ["purposeLoans", "Empréstimos e financiamentos"],
  ["purposeInvestments", "Investimentos"],
  ["purposeCreditCard", "Cartão de crédito"],
  ["purposeInsurance", "Seguro, previdência, capitalização e consórcios"],
  ["purposeForeignExchange", "Operações internacionais e câmbio"],
];

/**
 * Declaração de propósitos como no SICAQ: caixas de marcar, e o financiamento
 * habitacional (Sim/Não) só habilitado com empréstimos e financiamentos.
 *
 * O cadastro distingue "não respondido" (`null`) de "não": a captura do
 * portal só preenche o que está vazio. Por isso, enquanto ninguém respondeu
 * aqui, o formulário não manda nada; a partir da primeira marcação (ou se o
 * cadastro já tem resposta), caixa desmarcada vai como "não".
 */
export function DeclaracaoPropositos({ inicial }: { inicial: Propositos }) {
  const [valores, setValores] = useState(inicial);
  const [respondida, setRespondida] = useState(() =>
    Object.values(inicial).some((valor) => valor !== null),
  );

  function marcar(nome: keyof Propositos, valor: boolean) {
    setRespondida(true);
    setValores((atual) => ({
      ...atual,
      [nome]: valor,
      // Sem empréstimos, o portal desmarca e desabilita o habitacional.
      ...(nome === "purposeLoans" && !valor ? { purposeHousingLoan: null } : {}),
    }));
  }

  const habitacionalAtivo = valores.purposeLoans === true;

  return (
    <fieldset className="grid gap-2 text-sm text-ink">
      <legend className="sr-only">Declaração de propósitos</legend>

      {CAIXAS.map(([nome, rotulo]) => (
        <div key={nome}>
          <label className="flex items-center gap-2">
            {/* A caixa desmarcada não vai no FormData; o oculto antes dela
                manda o "não" quando a declaração já foi respondida. */}
            {respondida ? <input type="hidden" name={nome} value="false" /> : null}
            <input
              type="checkbox"
              name={nome}
              value="true"
              checked={valores[nome] === true}
              onChange={(e) => marcar(nome, e.target.checked)}
              className="size-4"
            />
            {rotulo}
          </label>

          {nome === "purposeLoans" ? (
            <div
              role="radiogroup"
              aria-label="Financiamento habitacional"
              className={`ml-6 mt-1 flex items-center gap-4 ${habitacionalAtivo ? "" : "opacity-50"}`}
            >
              <span>Financiamento habitacional:</span>
              {respondida && !habitacionalAtivo ? (
                <input type="hidden" name="purposeHousingLoan" value="" />
              ) : null}
              {[
                [true, "Sim"],
                [false, "Não"],
              ].map(([valor, rotuloOpcao]) => (
                <label key={String(valor)} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="purposeHousingLoan"
                    value={String(valor)}
                    disabled={!habitacionalAtivo}
                    checked={valores.purposeHousingLoan === valor}
                    onChange={() => marcar("purposeHousingLoan", valor as boolean)}
                    className="size-4"
                  />
                  {rotuloOpcao}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </fieldset>
  );
}
