import { formatBRL, formatCpf, type MaritalStatus, type Modality } from "@corr/core";
import { DAMP_MO29300_HTML } from "./pagina-mo29300";

/**
 * DAMP (MO29300): declaração para enquadramento e uso do FGTS, uma por
 * participante.
 *
 * A Caixa distribui a DAMP como uma página HTML offline, com as regras e a
 * impressão dela. O sistema serve essa mesma página, só que já preenchida com
 * o que há no cadastro e no processo; o que falta o operador completa na
 * própria página e imprime, como fazia antes. O preenchimento é um script
 * colado no fim, que usa os mesmos eventos da página (seleção e clique), para
 * que ela mostre e esconda os blocos como se alguém tivesse digitado.
 */

export interface PessoaDaDamp {
  fullName: string;
  cpf: string;
  birthDate?: string | null;
  pis?: string | null;
  maritalStatus?: MaritalStatus | string | null;
  city?: string | null;
  uf?: string | null;
}

export interface RendaDaDamp {
  occupation?: string | null;
  grossCents?: number | null;
}

export interface DadosDaDamp {
  pessoa: PessoaDaDamp;
  rendas: RendaDaDamp[];
  processo: {
    modality?: Modality | string | null;
    propertyValueCents?: number | null;
    propertyAddress?: string | null;
  };
  escritorio: { city?: string | null };
  hoje?: Date;
}

/** O que o script faz na página, em ordem: seleções, cliques e textos. */
export interface PreenchimentoDaDamp {
  selecoes: [id: string, valor: string][];
  cliques: string[];
  textos: [id: string, valor: string][];
  /** Logradouro, nº, CEP e bairro do imóvel (um div editável). */
  enderecoImovel: string;
  /** Local, dia, mês e ano da assinatura (inputs sem id, na ordem). */
  assinatura: [local: string, dia: string, mes: string, ano: string];
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Opção do estado civil da página e, para casado, o regime de bens. */
const ESTADO_CIVIL: Record<MaritalStatus, [estado: string, regime?: string]> = {
  solteiro: ["solteiro"],
  casado_comunhao_parcial: ["casado", "parcial"],
  casado_comunhao_total: ["casado", "universal"],
  casado_separacao_bens: ["casado", "separacao"],
  divorciado: ["divorciado"],
  separado_judicialmente: ["divorciado"],
  viuvo: ["viuvo"],
  // A página trata união estável dentro de solteiro/viúvo/divorciado.
  uniao_estavel: ["solteiro"],
};

/** Opção do item 7 (Modalidade) para cada modalidade do processo. */
const MODALIDADE: Partial<Record<Modality, number>> = {
  aquisicao_imovel_novo: 1,
  aquisicao_imovel_usado: 1,
  aquisicao_terreno_construcao: 3,
  construcao: 4,
  reforma_ampliacao: 5,
};

function dataBr(iso: string | null | undefined): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : "";
}

function pisFormatado(pis: string | null | undefined): string {
  const d = (pis ?? "").replace(/\D/g, "");
  if (d.length !== 11) return d;
  return `${d.slice(0, 3)}.${d.slice(3, 8)}.${d.slice(8, 10)}-${d.slice(10)}`;
}

export function preencherDamp(dados: DadosDaDamp): PreenchimentoDaDamp {
  const { pessoa, processo } = dados;
  const selecoes: PreenchimentoDaDamp["selecoes"] = [];
  const cliques: string[] = [];
  const textos: PreenchimentoDaDamp["textos"] = [
    ["text_nome", pessoa.fullName],
    ["text_data1", dataBr(pessoa.birthDate)],
    ["text_cpf", formatCpf(pessoa.cpf)],
    ["text_pis", pisFormatado(pessoa.pis)],
  ];

  // 1 - Estado civil.
  const estado = ESTADO_CIVIL[pessoa.maritalStatus as MaritalStatus];
  if (estado) {
    selecoes.push(["selectEstCiv", estado[0]]);
    if (estado[1]) selecoes.push(["selectRegime", estado[1]]);
    if (pessoa.maritalStatus === "uniao_estavel") cliques.push("chkuniaoestavel1");
  }

  // 2 - Ocupação: a profissão da renda de maior valor.
  const principal = [...dados.rendas]
    .filter((renda) => renda.occupation?.trim())
    .sort((a, b) => (b.grossCents ?? 0) - (a.grossCents ?? 0))[0];
  if (principal) {
    cliques.push("chkocupacao1");
    textos.push(["text_ocupacao", principal.occupation!.trim()]);
    textos.push(["text_localocupa", pessoa.city ?? ""]);
    textos.push(["text_uf0", pessoa.uf ?? ""]);
  }

  // 3 - Residência.
  textos.push(["text_logradouro", pessoa.city ?? ""]);
  textos.push(["text_uf1", pessoa.uf ?? ""]);
  cliques.push("chkresidencia1");

  // 6 - Usufruto.
  cliques.push("chkusufruto1");

  // 7 - Modalidade, com o valor do imóvel.
  const modalidade = MODALIDADE[processo.modality as Modality];
  if (modalidade) {
    cliques.push(`chkmodalidade${modalidade}`);
    if (processo.propertyValueCents) {
      textos.push([
        `text_enquad${modalidade}`,
        formatBRL(processo.propertyValueCents).replace(/\s/g, " "),
      ]);
    }
  }

  const hoje = (dados.hoje ?? new Date()).toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  const [ano, mes, dia] = hoje.split("-");

  return {
    selecoes,
    cliques,
    textos: textos.filter(([, valor]) => valor !== ""),
    enderecoImovel: processo.propertyAddress?.trim() ?? "",
    assinatura: [dados.escritorio.city ?? "", dia!, MESES[Number(mes) - 1]!, ano!],
  };
}

/**
 * Script que roda depois dos da página (o `ready` dela é registrado antes).
 * Primeiro seleções e cliques, porque desmarcar uma opção apaga os textos do
 * bloco; depois os textos; por fim um `change`, que é o que a página usa para
 * liberar o botão Imprimir.
 */
function scriptDePreenchimento(preenchimento: PreenchimentoDaDamp, titulo: string): string {
  const json = JSON.stringify({ ...preenchimento, titulo }).replace(/</g, "\\u003c");
  return `<script>
$(function () {
  var p = ${json};
  document.title = p.titulo;
  p.selecoes.forEach(function (s) { $("#" + s[0]).val(s[1]).trigger("change"); });
  p.cliques.forEach(function (id) { var c = $("#" + id); if (!c.is(":checked")) c.click(); });
  p.textos.forEach(function (t) { $("#" + t[0]).val(t[1]); });
  if (p.enderecoImovel) $(".editableDiv").text(p.enderecoImovel);
  $("p > input.end_camp").each(function (i) { if (p.assinatura[i]) $(this).val(p.assinatura[i]); });
  $("#text_nome").trigger("change");
  window.scrollTo(0, 0);
});
</script>
`;
}

/** A página da DAMP da Caixa, preenchida para uma pessoa. */
export function paginaDaDamp(dados: DadosDaDamp): string {
  const script = scriptDePreenchimento(preencherDamp(dados), `DAMP - ${dados.pessoa.fullName}`);
  const fim = DAMP_MO29300_HTML.lastIndexOf("</html>");
  return DAMP_MO29300_HTML.slice(0, fim) + script + DAMP_MO29300_HTML.slice(fim);
}
