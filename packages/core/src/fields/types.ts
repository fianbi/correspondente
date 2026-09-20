import type { z } from "zod";

/**
 * Catálogo de campos: o registro único de tudo que um processo pode guardar.
 *
 * Três consumidores leem daqui — o formulário renderizado por fase, o gerador
 * de formulários em PDF (M5) e o motor de preenchimento da extensão (M4). Sem
 * esse registro comum, a extensão viraria um segundo modelo de dados paralelo
 * e cada campo novo teria que ser declarado três vezes.
 *
 * Campo não se declara direto na UI. Se não está aqui, não existe.
 */

export type FieldType =
  | "text"
  | "textarea"
  | "money"
  | "percent"
  | "int"
  | "date"
  | "datetime"
  | "boolean"
  | "select";

/**
 * Onde o valor mora.
 *
 * `column` é para o que toda listagem precisa (cliente, valor financiado,
 * status): fica em coluna nativa de `processes`, indexável e rápida de somar.
 * `value` é para o que só interessa dentro de uma fase: vai para
 * `process_field_values`, sem custo de schema a cada campo novo.
 */
export type FieldStorage =
  | { kind: "column"; column: string }
  | { kind: "value" };

export interface FieldOption {
  value: string;
  label: string;
}

/**
 * Campos cujas opções vêm do banco (bancos, agências, corretores, equipe).
 * O catálogo não pode listar os valores — eles mudam por escritório —, então
 * declara de onde a tela deve buscá-los.
 */
export type FieldOptionsSource =
  | "banks"
  | "agencies"
  | "brokers"
  | "real_estate_agencies"
  | "members";

export interface FieldDef {
  /** Chave canônica, estável para sempre: `process.valor_imovel`. */
  key: string;
  label: string;
  type: FieldType;
  storage: FieldStorage;
  options?: readonly FieldOption[];
  optionsSource?: FieldOptionsSource;
  help?: string;
  placeholder?: string;
  maxLength?: number;
  /** Validação e normalização do valor bruto vindo do formulário. */
  schema: z.ZodType;
}

export interface FieldBlock {
  key: string;
  title: string;
  description?: string;
  fields: string[];
}

export interface StageDef {
  key: string;
  label: string;
  blocks: FieldBlock[];
}

export interface FlowDef {
  key: string;
  name: string;
  stages: StageDef[];
}

/**
 * A parte serializável de um campo.
 *
 * `FieldDef` carrega o schema Zod, que é instância de classe e não atravessa a
 * fronteira servidor → cliente do React. A tela recebe esta visão; a validação
 * continua no servidor, onde o schema vive.
 */
export type FieldView = Omit<FieldDef, "schema">;

export function toFieldView(def: FieldDef): FieldView {
  const { schema: _schema, ...view } = def;
  return view;
}
