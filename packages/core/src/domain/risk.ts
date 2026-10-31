/**
 * Avaliação de risco do SICAQ: qual delas é a do financiamento habitacional.
 *
 * A tela "Formulários Enviados" lista as avaliações de todos os produtos do
 * cliente. Só a de habitação vale para o processo; as de CROT (crédito
 * rotativo), cartão e outros produtos são extras, mostradas à parte.
 *
 * O SICAQ escreve o produto em texto livre, e o mesmo produto já apareceu com
 * nomes diferentes. Por isso a decisão é por palavras, sem acento: o que fala
 * de habitação, imóvel ou dos programas habitacionais.
 */

/** Mesmo padrão da migration 0021, que classificou as avaliações já gravadas. */
const HABITACAO =
  /habita|imobili|imovel|sfh|sbpe|mcmv|minha casa|casa verde|moradia|financiamento de casa/;

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function isHousingRiskAssessment(row: {
  product?: string | null;
  requestType?: string | null;
}): boolean {
  return HABITACAO.test(semAcento(`${row.product ?? ""} ${row.requestType ?? ""}`));
}
