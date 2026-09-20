import type {
  CaptureOutcome,
  FieldMapping,
  FillOutcome,
  ScreenProfile,
  TransformName,
} from "./types";

/**
 * Motor de leitura e escrita nas telas dos portais.
 *
 * Trabalha sobre um `Document` qualquer: na extensão é a página aberta, no
 * teste é a fixture carregada. Não conhece Chrome, não conhece rede — é isso
 * que torna o comportamento verificável sem abrir o portal do banco.
 */

type FieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const TRANSFORMS: Record<TransformName, (value: string) => string> = {
  digits: (value) => value.replace(/\D+/g, ""),
  upper: (value) => value.toUpperCase(),
  /** `2026-09-20` (formato do sistema) vira `20/09/2026` (formato do portal). */
  date_br: (value) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
  },
  /** Centavos inteiros viram `1234,56`, que é como o portal aceita. */
  money_br: (value) => {
    const cents = Number(value);
    return Number.isFinite(cents) ? (cents / 100).toFixed(2).replace(".", ",") : value;
  },
  phone_ddd: (value) => value.replace(/\D+/g, "").slice(0, 2),
  phone_number: (value) => value.replace(/\D+/g, "").slice(2),
};

export function applyTransform(value: string, transform?: TransformName): string {
  if (!transform) return value;
  return TRANSFORMS[transform](value);
}

function findField(root: Document | Element, selector: string): FieldElement | null {
  return root.querySelector<FieldElement>(selector);
}

/**
 * Escreve no campo do jeito que a página percebe.
 *
 * Atribuir `.value` direto não avisa ninguém: telas antigas dependem de
 * `onchange` e frameworks reativos rastreiam o setter do protótipo. Usar o
 * setter nativo e disparar os eventos cobre os dois mundos — sem isso, o
 * portal salva o campo vazio mesmo com o texto aparecendo na tela.
 */
export function setFieldValue(element: FieldElement, value: string): void {
  // O protótipo vem da janela do próprio elemento, não do escopo global: o
  // SICAQ usa frames, e cada frame tem os seus próprios construtores. Comparar
  // com o `HTMLInputElement` global falharia justamente onde importa.
  const view = element.ownerDocument?.defaultView as (Window & typeof globalThis) | null;
  const prototype = view
    ? tagOf(element) === "select"
      ? view.HTMLSelectElement?.prototype
      : tagOf(element) === "textarea"
        ? view.HTMLTextAreaElement?.prototype
        : view.HTMLInputElement?.prototype
    : undefined;

  const setter = prototype
    ? Object.getOwnPropertyDescriptor(prototype, "value")?.set
    : undefined;
  if (setter) setter.call(element, value);
  else element.value = value;

  const EventCtor = view?.Event ?? Event;
  element.dispatchEvent(new EventCtor("input", { bubbles: true }));
  element.dispatchEvent(new EventCtor("change", { bubbles: true }));
}

/** Nome da tag em minúsculas — substitui `instanceof`, que não cruza realms. */
function tagOf(element: Element): string {
  return element.tagName.toLowerCase();
}

function isSelect(element: FieldElement): element is HTMLSelectElement {
  return tagOf(element) === "select";
}

/** Casa o valor com uma das opções do `<select>`, por código ou por rótulo. */
function matchOption(select: HTMLSelectElement, value: string): HTMLOptionElement | undefined {
  const alvo = value.trim().toLowerCase();
  const normalizar = (texto: string) =>
    texto
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");

  const opcoes = [...select.options];
  return (
    opcoes.find((option) => option.value.trim().toLowerCase() === alvo) ??
    opcoes.find((option) => normalizar(option.textContent ?? "") === normalizar(value))
  );
}

function conditionMet(root: Document | Element, mapping: FieldMapping): boolean {
  if (!mapping.when) return true;
  const gatilho = findField(root, mapping.when.selector);
  return gatilho?.value === mapping.when.equals;
}

export interface FillOptions {
  /** Campos já preenchidos na tela não são sobrescritos. */
  skipFilled?: boolean;
}

/**
 * Preenche a tela com os valores do processo.
 *
 * Nunca submete o formulário: quem confere e clica em salvar é o operador.
 * Essa é a diferença entre assistir e agir sozinho no sistema do banco.
 */
export function fillScreen(
  root: Document,
  screen: ScreenProfile,
  values: Record<string, string | null>,
  options: FillOptions = {},
): FillOutcome[] {
  const resultados: FillOutcome[] = [];

  for (const mapping of screen.mappings) {
    const base: Omit<FillOutcome, "status"> = {
      dataKey: mapping.dataKey,
      selector: mapping.selector,
    };

    if (!conditionMet(root, mapping)) {
      resultados.push({ ...base, status: "condicao_nao_atendida" });
      continue;
    }

    const bruto = values[mapping.dataKey];
    if (bruto === undefined || bruto === null || bruto === "") {
      resultados.push({ ...base, status: "sem_valor" });
      continue;
    }

    const element = findField(root, mapping.selector);
    if (!element) {
      resultados.push({ ...base, status: "campo_ausente" });
      continue;
    }

    if (options.skipFilled && element.value.trim() !== "") {
      resultados.push({ ...base, status: "sem_valor", written: element.value });
      continue;
    }

    const valor = applyTransform(bruto, mapping.transform);

    if (isSelect(element)) {
      const opcao = matchOption(element, valor);
      if (!opcao) {
        // Melhor deixar em branco do que escolher a opção errada: um campo
        // vazio o operador vê, um valor errado ele não percebe.
        resultados.push({ ...base, status: "opcao_ausente" });
        continue;
      }
      setFieldValue(element, opcao.value);
      resultados.push({ ...base, status: "preenchido", written: opcao.value });
      continue;
    }

    setFieldValue(element, valor);
    resultados.push({ ...base, status: "preenchido", written: valor });
  }

  return resultados;
}

/** Lê a tela do portal e devolve os dados no formato do sistema. */
export function captureScreen(root: Document, screen: ScreenProfile): CaptureOutcome[] {
  const resultados: CaptureOutcome[] = [];

  for (const mapping of screen.mappings) {
    if (!conditionMet(root, mapping)) continue;

    const element = findField(root, mapping.selector);
    if (!element) continue;

    const bruto = element.value?.trim() ?? "";
    if (bruto === "") continue;

    resultados.push({ dataKey: mapping.dataKey, value: reverseTransform(bruto, mapping.transform) });
  }

  return resultados;
}

/** Desfaz a conversão de formato na leitura (portal → sistema). */
export function reverseTransform(value: string, transform?: TransformName): string {
  switch (transform) {
    case "date_br": {
      const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
    }
    case "money_br": {
      const numero = Number(value.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(numero) ? String(Math.round(numero * 100)) : value;
    }
    default:
      return value;
  }
}

/** Escolhe o perfil de tela que corresponde à página aberta. */
export function matchScreen(
  screens: ScreenProfile[],
  url: string,
  root: Document,
): ScreenProfile | null {
  for (const screen of screens) {
    if (!url.includes(screen.urlPattern)) continue;
    if (screen.marker && !root.querySelector(screen.marker)) continue;
    return screen;
  }
  return null;
}

/**
 * Inventário dos campos da tela, para o modo de aprendizado.
 *
 * É o que a extensão mostra quando o operador vai ensinar um campo novo: o que
 * existe na página e o que o perfil já sabe preencher.
 */
export interface DiscoveredField {
  selector: string;
  name: string;
  tag: "input" | "select" | "textarea";
  type: string;
  label: string;
  known: boolean;
}

export function discoverFields(root: Document, screen: ScreenProfile | null): DiscoveredField[] {
  const conhecidos = new Set((screen?.mappings ?? []).map((mapping) => mapping.selector));
  const elementos = root.querySelectorAll<FieldElement>("input, select, textarea");
  const descobertos: DiscoveredField[] = [];

  for (const element of elementos) {
    const type = (element.getAttribute("type") ?? "text").toLowerCase();
    if (["hidden", "submit", "button", "image", "reset"].includes(type)) continue;

    const name = element.getAttribute("name");
    if (!name) continue;

    const selector = `[name="${name}"]`;
    descobertos.push({
      selector,
      name,
      tag: element.tagName.toLowerCase() as DiscoveredField["tag"],
      type,
      label: guessLabel(element),
      known: conhecidos.has(selector),
    });
  }

  return descobertos;
}

/**
 * Tenta descobrir o rótulo do campo.
 *
 * As telas do SICAQ são tabelas antigas, sem `<label for>`: o texto costuma
 * estar na célula anterior. A busca desce por esses casos na ordem do mais
 * confiável para o mais improvisado.
 */
function guessLabel(element: FieldElement): string {
  const id = element.getAttribute("id");
  if (id) {
    const label = element.ownerDocument.querySelector(`label[for="${id}"]`);
    const texto = label?.textContent?.trim();
    if (texto) return texto;
  }

  const labelPai = element.closest("label")?.textContent?.trim();
  if (labelPai) return labelPai;

  const celula = element.closest("td");
  const anterior = celula?.previousElementSibling?.textContent?.trim();
  if (anterior) return anterior.replace(/\s+/g, " ").slice(0, 60);

  const linhaAnterior = celula?.closest("tr")?.previousElementSibling?.textContent?.trim();
  if (linhaAnterior) return linhaAnterior.replace(/\s+/g, " ").slice(0, 60);

  return element.getAttribute("name") ?? "";
}
