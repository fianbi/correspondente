/**
 * Perguntas feitas na hora de gerar um formulário do banco.
 *
 * Nem tudo que vai no formulário está no cadastro: "pede cartão de crédito?",
 * "qual programa?" são decididos ali, na hora. Em vez de criar um campo no
 * processo para cada formulário, o mapeamento do modelo diz que aquele campo
 * do PDF é perguntado ao gerar. Cada modelo tem as suas perguntas.
 *
 * Tudo cabe no `fieldMap` do modelo (campo do PDF → origem do valor):
 *
 * - `perguntar.texto`             o operador digita o valor;
 * - `perguntar.marcar`            caixa de marcar; marcada vira "X";
 * - `perguntar.opcao:Grupo=Opção` uma opção de um grupo (só uma pode ser
 *   escolhida); o campo recebe "X" quando a opção escolhida é a dele.
 *
 * Chaves que começam com `#` não são campos do PDF:
 *
 * - `#opcoes:Grupo` → "A|B|C": ordem das opções do grupo, inclusive opções
 *   que não têm quadrinho no PDF (escolhê-las não marca nada);
 * - `#pronto` → chave do modelo pronto de onde o modelo veio.
 *
 * Fica fora do servidor porque a tela de geração (cliente) monta o formulário
 * a partir do mesmo mapeamento.
 */

export const PERGUNTAR_TEXTO = "perguntar.texto";
export const PERGUNTAR_MARCAR = "perguntar.marcar";
export const PERGUNTAR_OPCAO = "perguntar.opcao";

export type Pergunta =
  | { tipo: "texto"; campo: string }
  | { tipo: "marcar"; campo: string }
  | { tipo: "opcao"; grupo: string; opcoes: string[] };

/** Separa `perguntar.opcao:Grupo=Opção` em grupo e opção. */
export function lerOpcao(valor: string): { grupo: string; opcao: string } | null {
  if (!valor.startsWith(`${PERGUNTAR_OPCAO}:`)) return null;
  const resto = valor.slice(PERGUNTAR_OPCAO.length + 1);
  const igual = resto.indexOf("=");
  if (igual <= 0) return null;
  return { grupo: resto.slice(0, igual), opcao: resto.slice(igual + 1) };
}

export function montarOpcao(grupo: string, opcao: string): string {
  return `${PERGUNTAR_OPCAO}:${grupo.trim()}=${opcao.trim()}`;
}

export function ehChaveInterna(campo: string): boolean {
  return campo.startsWith("#");
}

/** Perguntas do modelo, na ordem dos campos do mapeamento. */
export function perguntasDoModelo(fieldMap: Record<string, string>): Pergunta[] {
  const perguntas: Pergunta[] = [];
  const grupos = new Map<string, Extract<Pergunta, { tipo: "opcao" }>>();

  for (const [campo, valor] of Object.entries(fieldMap)) {
    if (ehChaveInterna(campo)) continue;
    if (valor === PERGUNTAR_TEXTO) perguntas.push({ tipo: "texto", campo });
    else if (valor === PERGUNTAR_MARCAR) perguntas.push({ tipo: "marcar", campo });
    else {
      const opcao = lerOpcao(valor);
      if (!opcao) continue;
      let grupo = grupos.get(opcao.grupo);
      if (!grupo) {
        const ordem = fieldMap[`#opcoes:${opcao.grupo}`]?.split("|").filter(Boolean) ?? [];
        grupo = { tipo: "opcao", grupo: opcao.grupo, opcoes: [...ordem] };
        grupos.set(opcao.grupo, grupo);
        perguntas.push(grupo);
      }
      if (!grupo.opcoes.includes(opcao.opcao)) grupo.opcoes.push(opcao.opcao);
    }
  }

  return perguntas;
}

/** Nome do parâmetro de cada resposta na URL de geração. */
export const parametroDe = {
  texto: (campo: string) => `t:${campo}`,
  marcar: (campo: string) => `m:${campo}`,
  opcao: (grupo: string) => `o:${grupo}`,
};

/** Valor de um campo perguntado, a partir das respostas da tela de geração. */
export function responder(
  campo: string,
  valor: string,
  respostas: Record<string, string>,
): string | null {
  if (valor === PERGUNTAR_TEXTO) return respostas[parametroDe.texto(campo)]?.trim() ?? "";
  if (valor === PERGUNTAR_MARCAR) return respostas[parametroDe.marcar(campo)] ? "X" : "";
  const opcao = lerOpcao(valor);
  if (opcao) return respostas[parametroDe.opcao(opcao.grupo)] === opcao.opcao ? "X" : "";
  return null;
}
