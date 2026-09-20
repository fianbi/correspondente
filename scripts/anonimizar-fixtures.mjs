/**
 * Gera fixtures anonimizadas a partir das capturas dos portais.
 *
 * As capturas originais (`benchmarks/`) têm dado pessoal real e ficam fora do
 * controle de versão. Este script produz cópias em `fixtures/`, versionáveis,
 * com a mesma estrutura de formulário e nenhum valor preenchido — é contra
 * elas que o motor de preenchimento da extensão é testado.
 *
 * A limpeza não confia só em esvaziar `value`. O que o operador digitou
 * reaparece em texto solto (o nome de quem está logado no cabeçalho, por
 * exemplo), e numa tela que não tem campo preenchido nenhum. Por isso o script
 * roda em duas passagens: primeiro descobre, em TODAS as capturas, o que foi
 * digitado; depois limpa cada arquivo com o que o conjunto revelou.
 *
 * Uso: node scripts/anonimizar-fixtures.mjs
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const origem = join(raiz, "benchmarks/caixa/sicaq");
const destino = join(raiz, "fixtures/caixa");

/** Valores estruturais, não dado de pessoa. */
const ESTRUTURAIS = new Set(["on", "off", "true", "false", "s", "n", "sim", "nao", ""]);

/** Palavras de formulário que não identificam ninguém. */
const IGNORAR = new Set([
  "consultar", "salvar", "cancelar", "voltar", "avancar", "continuar", "limpar",
  "pesquisar", "incluir", "alterar", "excluir", "confirmar", "sair", "menu",
  "nada", "outros", "outro",
]);

/** Campos cujo conteúdo é nome de pessoa: deles saem também as palavras soltas. */
const CAMPOS_DE_NOME = /nome|conjuge|mae|pai|razao/i;

function coletarSegredos(html, acumulador) {
  const { valores, palavras } = acumulador;

  const adicionar = (valor, nomeDoCampo) => {
    const limpo = valor.trim();
    if (!limpo || ESTRUTURAIS.has(limpo.toLowerCase())) return;
    if (/^[\d.,/-]{1,4}$/.test(limpo)) return; // código curto, UF, mês
    // Valor curto é código de domínio ("F", "01"), não identifica ninguém — e
    // apagá-lo do documento inteiro mutilaria nomes de atributo.
    if (limpo.length < 4) return;
    valores.add(limpo);

    // Só nome de pessoa vira palavra solta: quebrar um endereço em pedaços
    // apagaria "RUA" e "CENTRO" de todas as listas do portal.
    if (CAMPOS_DE_NOME.test(nomeDoCampo)) {
      for (const palavra of limpo.split(/[\s.,/-]+/)) {
        if (palavra.length >= 4 && !IGNORAR.has(palavra.toLowerCase())) palavras.add(palavra);
      }
    }
  };

  for (const m of html.matchAll(/<input\b[^>]*>/gi)) {
    const tag = m[0];
    const tipo = (tag.match(/type\s*=\s*"?([a-z]+)"?/i)?.[1] ?? "text").toLowerCase();
    if (["radio", "checkbox", "submit", "button", "image"].includes(tipo)) continue;

    const valor = tag.match(/\bvalue\s*=\s*"([^"]*)"/i)?.[1];
    const nome = tag.match(/\bname\s*=\s*"([^"]*)"/i)?.[1] ?? "";
    if (valor !== undefined) adicionar(valor, nome);
  }

  for (const m of html.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi)) {
    adicionar(m[2], m[1]);
  }
}

function anonimizar(html, segredos) {
  let saida = html;

  // 1. Fora o JavaScript e o CSS do portal: em teste só atrapalham, e são o
  //    que faria a página tentar falar com o banco.
  saida = saida.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  saida = saida.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  saida = saida.replace(/<link\b[^>]*>/gi, "");

  // 2. Esvazia todo campo preenchido, mantendo a estrutura.
  saida = saida.replace(/<input\b[^>]*>/gi, (tag) => {
    const tipo = (tag.match(/type\s*=\s*"?([a-z]+)"?/i)?.[1] ?? "text").toLowerCase();
    if (tipo === "radio" || tipo === "checkbox") {
      return tag.replace(/\schecked(\s*=\s*"[^"]*")?/gi, "");
    }
    if (["submit", "button", "image"].includes(tipo)) return tag;
    return tag.replace(/\svalue\s*=\s*"[^"]*"/gi, ' value=""');
  });
  saida = saida.replace(/\sselected(\s*=\s*"[^"]*")?/gi, "");
  saida = saida.replace(/<textarea\b([^>]*)>[\s\S]*?<\/textarea>/gi, "<textarea$1></textarea>");

  // 3. Apaga o que sobrou em texto visível.
  //
  //    Só entre tags, nunca dentro delas: uma limpeza cega no documento
  //    inteiro mutila nome de atributo (`dataCpf` virou `dataCp` numa versão
  //    anterior deste script) e destrói justamente a estrutura que a fixture
  //    existe para preservar.
  saida = saida.replace(/>([^<]+)</g, (_todo, texto) => `>${limparTexto(texto, segredos)}<`);

  // 4. Referências à pasta de assets da captura, que não é versionada.
  saida = saida.replace(/(src|href)\s*=\s*"[^"]*_files\/[^"]*"/gi, '$1="#"');

  return saida;
}

/** Limpeza aplicada a um nó de texto. */
function limparTexto(texto, segredos) {
  let saida = texto;

  for (const segredo of segredos) {
    for (const variante of new Set([segredo, segredo.toUpperCase(), segredo.toLowerCase()])) {
      saida = saida.replaceAll(variante, "");
    }
  }

  return saida
    .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, "")
    .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, "")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "")
    .replace(/\d{11,14}/g, "");
}

/** Nomes de campo presentes no HTML — a estrutura que a fixture precisa manter. */
function camposDe(html) {
  return new Set([...html.matchAll(/name\s*=\s*"([^"]+)"/gi)].map((m) => m[1]));
}

/** Falha alto em vez de gravar dado pessoal no repositório. */
function conferir(html, arquivo, segredos) {
  const suspeitos = [
    [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, "CPF com máscara"],
    [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, "e-mail"],
    [/\b\d{11,14}\b/, "sequência longa de dígitos"],
  ];

  for (const [padrao, descricao] of suspeitos) {
    const achado = html.match(padrao);
    if (achado) throw new Error(`${arquivo}: ${descricao} remanescente (${achado[0].slice(0, 30)})`);
  }

  for (const segredo of segredos) {
    if (segredo.length < 4) continue;
    if (html.toLowerCase().includes(segredo.toLowerCase())) {
      throw new Error(`${arquivo}: valor preenchido remanescente (${segredo.slice(0, 30)})`);
    }
  }
}

/**
 * A fixture só serve se tiver exatamente os mesmos campos da captura.
 * Foi esta conferência que pegou a limpeza mutilando nome de atributo.
 */
function conferirEstrutura(original, anonimo, arquivo) {
  const antes = camposDe(original);
  const depois = camposDe(anonimo);

  const perdidos = [...antes].filter((nome) => !depois.has(nome));
  if (perdidos.length > 0) {
    throw new Error(`${arquivo}: campos perdidos na limpeza: ${perdidos.slice(0, 5).join(", ")}`);
  }
}

function main() {
  let arquivos;
  try {
    arquivos = readdirSync(origem).filter((nome) => nome.endsWith(".html"));
  } catch {
    console.error(`Capturas não encontradas em ${origem}.`);
    console.error("Salve as telas do portal ali (elas não entram no repositório) e rode de novo.");
    process.exit(1);
  }

  mkdirSync(destino, { recursive: true });

  // Passagem 1: descobre em todas as capturas o que foi digitado.
  const acumulador = { valores: new Set(), palavras: new Set() };
  const conteudos = new Map();
  for (const arquivo of arquivos) {
    const html = readFileSync(join(origem, arquivo), "latin1");
    conteudos.set(arquivo, html);
    coletarSegredos(html, acumulador);
  }

  const segredos = [...new Set([...acumulador.valores, ...acumulador.palavras])].sort(
    (a, b) => b.length - a.length,
  );
  console.log(`${segredos.length} valores sensíveis identificados no conjunto das capturas.\n`);

  // Passagem 2: limpa cada arquivo com o que o conjunto revelou.
  for (const arquivo of arquivos) {
    const original = conteudos.get(arquivo);
    const anonimo = anonimizar(original, segredos);
    conferir(anonimo, arquivo, segredos);
    conferirEstrutura(original, anonimo, arquivo);

    const nomeSaida = arquivo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9.]+/g, "-");

    writeFileSync(join(destino, nomeSaida), anonimo, "utf8");
    console.log(`${arquivo} -> fixtures/caixa/${nomeSaida}`);
  }

  console.log(`\n${arquivos.length} fixture(s) gerada(s).`);
}

main();
