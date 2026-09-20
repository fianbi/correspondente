/**
 * Perfil de um portal de banco: como achar cada campo na tela e para qual dado
 * do sistema ele corresponde.
 *
 * O perfil é dado, não código. Os do Caixa Aqui nascem versionados aqui, mas o
 * escritório pode ensinar campos novos pela extensão, e esses ficam no banco —
 * é o que permite acompanhar mudança de tela do portal sem esperar release.
 */

export interface FieldMapping {
  /** Chave do catálogo (`@corr/core/fields`) ou do cadastro de pessoa. */
  dataKey: string;
  /** Seletor CSS do campo na página do portal. */
  selector: string;
  /** Como converter o valor do sistema no que o portal aceita. */
  transform?: TransformName;
  /**
   * Só aplica quando outro campo da tela estiver com determinado valor.
   * É o que resolve os grupos que trocam conforme o tipo de documento.
   */
  when?: { selector: string; equals: string };
}

export type TransformName =
  | "digits"
  | "date_br"
  | "upper"
  | "money_br"
  | "phone_ddd"
  | "phone_number";

export interface ScreenProfile {
  key: string;
  label: string;
  /** Padrão que a URL da aba precisa conter para a tela ser reconhecida. */
  urlPattern: string;
  /** Seletor que confirma que a tela é essa mesmo (evita falso positivo). */
  marker?: string;
  mappings: FieldMapping[];
}

export interface PortalProfile {
  key: string;
  label: string;
  hostPattern: string;
  screens: ScreenProfile[];
}

/** Um valor pronto para ser escrito na tela do portal. */
export interface FillValue {
  dataKey: string;
  value: string | null;
}

export interface FillOutcome {
  dataKey: string;
  selector: string;
  status: "preenchido" | "sem_valor" | "campo_ausente" | "condicao_nao_atendida" | "opcao_ausente";
  written?: string;
}

export interface CaptureOutcome {
  dataKey: string;
  value: string | null;
}
