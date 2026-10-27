import { bestScreenForFieldNames, captureScreen } from "./engine";
import { readSavedIncomes, type SavedIncome } from "./saved-incomes";
import type { PortalProfile } from "./types";

/**
 * Leitura de uma tela do portal para a captura automática.
 *
 * A extensão chama isto no envio do formulário ou na saída da página, sem
 * ninguém escolher processo nem tela: a tela é reconhecida pelos campos que
 * existem no documento, e a pessoa é identificada pelo CPF.
 *
 * Só lê. Nada aqui escreve no documento.
 */

export interface AutoCapture {
  /** Tela reconhecida; `null` na tela de entrada do CPF, que não tem dados. */
  screenKey: string | null;
  /** CPF digitado na entrada ou mostrado pela tela, só dígitos; `null` se nenhum. */
  cpf: string | null;
  /** Valores já no formato do sistema, sem o CPF. */
  values: Record<string, string>;
  /** Rendas já cadastradas no portal, nas telas de renda; vazio nas outras. */
  incomes: SavedIncome[];
}

/** Nomes dos campos que o operador vê (os ocultos são controle do portal). */
function visibleFieldNames(root: Document): string[] {
  const nomes = new Set<string>();
  for (const elemento of Array.from(
    root.querySelectorAll("input[name], select[name], textarea[name]"),
  )) {
    if ((elemento.getAttribute("type") ?? "").toLowerCase() === "hidden") continue;
    const nome = elemento.getAttribute("name");
    if (nome) nomes.add(nome);
  }
  return [...nomes];
}

function cpfDigits(value: string | null | undefined): string | null {
  const digitos = (value ?? "").replace(/\D+/g, "");
  return digitos.length === 11 ? digitos : null;
}

export function readForAutoCapture(root: Document, profile: PortalProfile): AutoCapture | null {
  // O CPF digitado na entrada do cadastro manda: é a escolha do operador. Um
  // `#cpf` oculto não conta: o portal reaproveita o id como campo auxiliar em
  // páginas de consulta (formulários enviados), com o CPF de outra linha.
  const campoDeEntrada = profile.cpfEntrySelector
    ? root.querySelector<HTMLInputElement>(profile.cpfEntrySelector)
    : null;
  const entrada =
    campoDeEntrada && campoDeEntrada.type !== "hidden" ? cpfDigits(campoDeEntrada.value) : null;

  const reconhecida = bestScreenForFieldNames(profile.screens, visibleFieldNames(root));
  if (!reconhecida) return entrada ? { screenKey: null, cpf: entrada, values: {}, incomes: [] } : null;

  const values: Record<string, string> = {};
  let cpf: string | null = entrada;

  for (const { dataKey, value } of captureScreen(root, reconhecida.screen)) {
    if (value === null) continue;

    if (dataKey === "person.cpf") {
      // A pesquisa cadastral mostra o CPF com máscara; a de cadastro, sem.
      cpf ??= cpfDigits(value);
      continue;
    }

    // Um dado espalhado em mais de um campo (DDD e número do telefone) volta
    // na ordem da tela, e juntar os pedaços refaz o valor do sistema.
    values[dataKey] = values[dataKey] === undefined ? value : values[dataKey] + value;
  }

  // O formulário de renda é só para a próxima fonte; as já cadastradas estão
  // na lista, e é ela que vai para o sistema.
  const incomes = reconhecida.screen.needsIncome ? (readSavedIncomes(root) ?? []) : [];
  if (reconhecida.screen.needsIncome) {
    for (const chave of Object.keys(values)) if (chave.startsWith("income.")) delete values[chave];
  }

  return { screenKey: reconhecida.screen.key, cpf, values, incomes };
}

/**
 * Identidade de um envio: mesma pessoa, mesma tela, mesmos valores.
 *
 * As chaves entram ordenadas para que a ordem de leitura não faça o mesmo
 * conteúdo parecer novo.
 */
export function autoCaptureKey(
  cpf: string,
  screenKey: string | null,
  values: Record<string, string>,
  incomes: SavedIncome[] = [],
): string {
  const ordenar = (objeto: object) =>
    Object.entries(objeto).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([cpf, screenKey, ordenar(values), incomes.map(ordenar)]);
}
