"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/field";
import {
  CAMPO_CIDADE_AGENCIA_NOVA,
  CAMPO_NOME_AGENCIA_NOVA,
  NUMERO_AGENCIA,
  rotuloAgencia,
  type AgenciaOpcao,
} from "@/lib/agencias";

type Resolucao =
  | { tipo: "vazia" }
  | { tipo: "existente"; agencia: AgenciaOpcao }
  | { tipo: "nova"; numero: string }
  | { tipo: "invalida" };

function resolver(texto: string, agencias: AgenciaOpcao[]): Resolucao {
  const digitado = texto.trim();
  if (!digitado) return { tipo: "vazia" };
  const minusculo = digitado.toLowerCase();

  const porRotulo = agencias.find((a) => rotuloAgencia(a).toLowerCase() === minusculo);
  if (porRotulo) return { tipo: "existente", agencia: porRotulo };

  // "1234", "1234 — Centro" ou "1234 Centro": vale o número do começo.
  const numero = digitado.split(/\s*[—–-]\s+|\s+/)[0] ?? "";
  const porNumero = agencias.find((a) => a.number === numero);
  if (porNumero) return { tipo: "existente", agencia: porNumero };

  const porNome = agencias.filter((a) => a.name.trim().toLowerCase() === minusculo);
  if (porNome.length === 1 && porNome[0]) return { tipo: "existente", agencia: porNome[0] };

  if (NUMERO_AGENCIA.test(numero)) return { tipo: "nova", numero };
  return { tipo: "invalida" };
}

/**
 * Agência do processo: escolhe-se do cadastro do escritório digitando o
 * número, o nome ou a cidade (a lista sugere enquanto se digita). Número que
 * ainda não está no cadastro vira agência nova ao salvar, com nome e cidade
 * informados ali mesmo.
 */
export function AgencyInput({
  name,
  label,
  hint,
  error,
  agencias,
  atualId,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  agencias: AgenciaOpcao[];
  atualId: string;
}) {
  const atual = agencias.find((a) => a.id === atualId);
  const [texto, setTexto] = useState(atual ? rotuloAgencia(atual) : "");
  const resolucao = resolver(texto, agencias);
  const id = `field-${name}`;
  const listaId = `${id}-sugestoes`;

  const valor =
    resolucao.tipo === "existente"
      ? resolucao.agencia.id
      : resolucao.tipo === "nova"
        ? resolucao.numero
        : resolucao.tipo === "invalida"
          ? texto.trim()
          : "";

  const aviso =
    resolucao.tipo === "nova"
      ? `Agência ${resolucao.numero} ainda não está no cadastro: será cadastrada ao salvar.`
      : resolucao.tipo === "invalida"
        ? "Nenhuma agência com esse nome. Para cadastrar uma nova, digite o número dela."
        : undefined;

  return (
    <div className="flex flex-col gap-3">
      <Field label={label} name={name} hint={aviso ?? hint} error={error}>
        <>
          <Input
            id={id}
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            placeholder="Número, nome ou cidade da agência"
            list={listaId}
            autoComplete="off"
            invalid={Boolean(error)}
          />
          <input type="hidden" name={name} value={valor} />
          <datalist id={listaId}>
            {agencias.map((agencia) => (
              <option key={agencia.id} value={rotuloAgencia(agencia)} />
            ))}
          </datalist>
        </>
      </Field>

      {resolucao.tipo === "nova" ? (
        <div className="flex flex-col gap-3 rounded-md border border-dashed border-line p-3">
          <Field
            label="Nome da agência nova"
            name={CAMPO_NOME_AGENCIA_NOVA}
            placeholder="Ex.: Centro"
          />
          <Field label="Cidade" name={CAMPO_CIDADE_AGENCIA_NOVA} />
        </div>
      ) : null}
    </div>
  );
}
