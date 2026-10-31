import { describe, expect, it } from "vitest";
import { isHousingRiskAssessment } from "./risk";

describe("isHousingRiskAssessment", () => {
  it.each(["Habitação", "HABITACAO", "Crédito Imobiliário", "Financiamento SBPE", "MCMV - Faixa 2"])(
    "%s é habitação",
    (product) => expect(isHousingRiskAssessment({ product })).toBe(true),
  );

  it.each(["CROT", "Crédito Rotativo", "Cartão de Crédito SIM", "Proposta de Cartão de Crédito", null])(
    "%s é extra",
    (product) => expect(isHousingRiskAssessment({ product })).toBe(false),
  );

  it("o tipo de pedido também conta", () => {
    expect(isHousingRiskAssessment({ product: null, requestType: "Avaliação de Risco Habitacional" })).toBe(true);
  });
});
