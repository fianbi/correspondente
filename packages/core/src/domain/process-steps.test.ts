import { describe, expect, it } from "vitest";
import { MODALITIES } from "./process";
import {
  detoursFrom,
  nextStep,
  resolveCurrentStep,
  stepsForModality,
} from "./process-steps";

describe("andamento por modalidade", () => {
  it("toda modalidade tem roteiro que começa na captação e termina na matrícula", () => {
    for (const modality of MODALITIES) {
      const steps = stepsForModality(modality);
      expect(steps[0]?.key).toBe("captacao");
      expect(steps.at(-1)?.key).toBe("envio_matricula");
    }
  });

  it("construção tem engenharia local e PEPT; imóvel usado não", () => {
    const construcao = stepsForModality("aquisicao_terreno_construcao").map((s) => s.key);
    const usado = stepsForModality("aquisicao_imovel_usado").map((s) => s.key);
    expect(construcao).toContain("projeto_prefeitura");
    expect(construcao).toContain("ajustes_pept");
    expect(usado).not.toContain("projeto_prefeitura");
    expect(usado).not.toContain("ajustes_pept");
  });

  it("empréstimo com garantia não tem ITBI nem vendedor", () => {
    const keys = stepsForModality("emprestimo_garantia_imovel").map((s) => s.key);
    expect(keys).not.toContain("itbi");
    expect(keys).not.toContain("assinatura");
    expect(keys).toContain("registro_garantia");
  });

  it("as fases dos passos seguem a ordem do funil", () => {
    const order = ["cadastro", "correspondente", "montagem", "conformidade_contrato", "agencia", "cri"];
    for (const modality of MODALITIES) {
      const idx = stepsForModality(modality).map((s) => order.indexOf(s.phase));
      expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    }
  });

  it("concluir pula o desvio e o desvio volta para quem o abriu", () => {
    const steps = stepsForModality("aquisicao_terreno_construcao");
    const vistoria = steps.find((s) => s.key === "vistoria_engenharia")!;
    expect(nextStep(steps, vistoria)?.key).toBe("proposta_siopi");
    expect(detoursFrom(steps, vistoria).map((s) => s.key)).toEqual(["ajustes_pept"]);
    const pept = steps.find((s) => s.key === "ajustes_pept")!;
    expect(nextStep(steps, pept)?.key).toBe("vistoria_engenharia");
  });

  it("sem passo gravado, o andamento é deduzido pela fase", () => {
    const steps = stepsForModality("aquisicao_imovel_usado");
    expect(resolveCurrentStep(steps, null, "cadastro").key).toBe("captacao");
    expect(resolveCurrentStep(steps, null, "agencia").key).toBe("revisao_gerente");
    // Passo de outro roteiro (PEPT num imóvel usado) também cai na fase.
    expect(resolveCurrentStep(steps, "ajustes_pept", "correspondente").key).toBe("analise_risco");
  });
});
