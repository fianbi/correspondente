import { bestScreenForFieldNames, type PortalProfile, type ScreenProfile } from "@corr/portal";
import type { PanelRequest, PanelResponse } from "./messages";

/**
 * Ponte entre o painel e a página do banco.
 *
 * O portal pode montar a tela dentro de um frame — o documento de cima fica
 * só com o menu, e os campos moram em outro documento. Por isso o painel sonda
 * todos os frames, escolhe aquele que realmente tem os campos do perfil, e
 * conversa só com ele dali em diante.
 */

export interface QuadroSondado {
  frameId: number;
  url: string;
  /** Campos que o operador vê na tela — os que interessam para mapear. */
  fieldNames: string[];
  /** Campos de controle do portal, contados mas não listados. */
  hiddenCount: number;
}

export interface Reconhecimento {
  /** Frame que respondeu com a tela reconhecida, quando houve. */
  frameId: number | null;
  screen: ScreenProfile | null;
  found: number;
  total: number;
  /** Todos os frames vistos — é o que a tela de diagnóstico mostra. */
  quadros: QuadroSondado[];
}

async function abaAtiva(): Promise<chrome.tabs.Tab | null> {
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  return aba ?? null;
}

/** Lê de cada frame a lista de campos com `name`, sem trazer o documento. */
async function sondarQuadros(tabId: number): Promise<QuadroSondado[]> {
  const resultados = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () => {
      const elementos = Array.from(
        document.querySelectorAll("input[name], select[name], textarea[name]"),
      );

      const visiveis: string[] = [];
      let ocultos = 0;

      for (const elemento of elementos) {
        const nome = elemento.getAttribute("name");
        if (!nome) continue;

        const tipo = (elemento.getAttribute("type") ?? "").toLowerCase();
        // Campo oculto é controle interno do portal (_changed, _opcao…). Ele
        // conta para o total, mas listá-lo primeiro esconderia justamente os
        // campos que servem para mapear a tela.
        if (tipo === "hidden") ocultos += 1;
        else if (!visiveis.includes(nome)) visiveis.push(nome);
      }

      return { url: location.href, fieldNames: visiveis, hiddenCount: ocultos };
    },
  });

  return resultados
    .filter((resultado) => resultado.result)
    .map((resultado) => ({
      frameId: resultado.frameId,
      url: resultado.result!.url,
      fieldNames: resultado.result!.fieldNames,
      hiddenCount: resultado.result!.hiddenCount,
    }));
}

/**
 * Descobre qual tela do perfil está aberta e em qual frame.
 *
 * Quando nada é reconhecido, devolve mesmo assim o que foi visto em cada
 * frame: sem isso, a extensão só saberia dizer "não mapeada", e quem está do
 * outro lado não teria como descobrir o porquê.
 */
export async function reconhecerPagina(profile: PortalProfile): Promise<Reconhecimento> {
  const aba = await abaAtiva();
  if (!aba?.id) {
    return { frameId: null, screen: null, found: 0, total: 0, quadros: [] };
  }

  let quadros: QuadroSondado[] = [];
  try {
    quadros = await sondarQuadros(aba.id);
  } catch {
    // Sem permissão para esta aba (outro site, página interna do navegador).
    return { frameId: null, screen: null, found: 0, total: 0, quadros: [] };
  }

  let melhor: Reconhecimento = { frameId: null, screen: null, found: 0, total: 0, quadros };

  for (const quadro of quadros) {
    const resultado = bestScreenForFieldNames(profile.screens, quadro.fieldNames);
    if (resultado && resultado.found > melhor.found) {
      melhor = {
        frameId: quadro.frameId,
        screen: resultado.screen,
        found: resultado.found,
        total: resultado.total,
        quadros,
      };
    }
  }

  return melhor;
}

/** Envia uma ordem para o frame escolhido. */
export async function pedirAoQuadro(
  frameId: number,
  request: PanelRequest,
): Promise<PanelResponse> {
  const aba = await abaAtiva();
  if (!aba?.id) return { kind: "erro", message: "Nenhuma aba aberta." };

  try {
    return await chrome.tabs.sendMessage(aba.id, request, { frameId });
  } catch {
    return {
      kind: "erro",
      message: "A página mudou desde a última leitura. Recarregue o painel.",
    };
  }
}
