import type {
  AutoCapture,
  CaptureOutcome,
  DiscoveredField,
  FillOutcome,
  PortalProfile,
} from "@corr/portal";

/**
 * Contrato entre o painel lateral e o content script.
 *
 * São contextos separados por desenho do navegador: o painel não toca no DOM
 * da página, e o content script não conhece a API do sistema.
 *
 * Quem decide qual tela está aberta é o painel, que sonda todos os frames —
 * por isso a ordem já chega com a tela escolhida. O content script executa,
 * não adivinha.
 */
export type PanelRequest =
  | {
      kind: "preencher";
      profile: PortalProfile;
      screenKey: string;
      values: Record<string, string | null>;
      skipFilled: boolean;
    }
  | { kind: "capturar"; profile: PortalProfile; screenKey: string }
  | { kind: "descobrir"; profile: PortalProfile; screenKey: string | null }
  | { kind: "destacar"; selector: string };

export type PanelResponse =
  | { kind: "preenchido"; outcomes: FillOutcome[] }
  | { kind: "capturado"; values: CaptureOutcome[] }
  | { kind: "descoberto"; fields: DiscoveredField[] }
  | { kind: "ok" }
  | { kind: "erro"; message: string };

/**
 * Do content script para o background, na captura automática.
 *
 * `carregou` só serve para guardar o CPF da tela; quem gera envio é `enviou`
 * (submit do formulário) e `saiu` (a página está sendo descarregada).
 */
export interface CapturaDaPagina {
  kind: "captura-auto";
  momento: "carregou" | "enviou" | "saiu";
  captura: AutoCapture;
}
