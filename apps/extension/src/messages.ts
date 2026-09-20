import type { CaptureOutcome, DiscoveredField, FillOutcome, PortalProfile } from "@corr/portal";

/**
 * Contrato entre o painel lateral e o content script.
 *
 * São contextos separados por desenho do navegador: o painel não toca no DOM
 * da página, e o content script não conhece a API do sistema. Tudo que
 * atravessa essa fronteira passa por aqui.
 */
export type PanelRequest =
  | { kind: "reconhecer"; profile: PortalProfile }
  | {
      kind: "preencher";
      profile: PortalProfile;
      values: Record<string, string | null>;
      skipFilled: boolean;
    }
  | { kind: "capturar"; profile: PortalProfile }
  | { kind: "descobrir"; profile: PortalProfile }
  | { kind: "destacar"; selector: string };

export type PanelResponse =
  | { kind: "reconhecido"; screenKey: string | null; screenLabel: string | null; url: string }
  | { kind: "preenchido"; outcomes: FillOutcome[] }
  | { kind: "capturado"; values: CaptureOutcome[] }
  | { kind: "descoberto"; fields: DiscoveredField[]; screenKey: string | null }
  | { kind: "ok" }
  | { kind: "erro"; message: string };
