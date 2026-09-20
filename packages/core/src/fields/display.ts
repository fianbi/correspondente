import { formatBRL } from "../format/currency";
import { getField } from "./catalog";
import type { FieldView } from "./types";

/**
 * Converte o valor cru (como está gravado) na forma que o operador reconhece.
 *
 * O histórico guarda tudo como texto — "35000000" não diz nada para quem lê.
 * Quem sabe traduzir é o catálogo, que conhece o tipo e as opções do campo.
 */
export function formatFieldValue(def: FieldView | undefined, raw: string | null): string {
  if (raw === null || raw === "") return "—";
  if (!def) return raw;

  switch (def.type) {
    case "money":
      return formatBRL(Number(raw));
    case "date":
    case "datetime": {
      const [ano, mes, dia] = raw.split("-");
      return dia && mes && ano ? `${dia}/${mes}/${ano}` : raw;
    }
    case "boolean":
    case "select": {
      const option = def.options?.find((o) => o.value === raw);
      // Campo de relação (banco, corretor) guarda uuid: quem resolve o nome é a
      // tela, que tem a lista carregada. Aqui devolve o cru em vez de mentir.
      return option?.label ?? raw;
    }
    default:
      return raw;
  }
}

/** Mesmo que `formatFieldValue`, buscando o campo pela chave. */
export function formatValueByKey(key: string, raw: string | null): string {
  return formatFieldValue(getField(key), raw);
}

/** Valor do banco no formato que o `<input>` espera. */
export function toInputValue(def: FieldView, raw: string | number | null): string {
  if (raw === null || raw === undefined) return "";

  if (def.type === "money") {
    const cents = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(cents) ? (cents / 100).toFixed(2).replace(".", ",") : "";
  }

  return String(raw);
}
