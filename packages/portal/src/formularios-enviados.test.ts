import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { hasRiskAssessment, readSentForms } from "./formularios-enviados";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function carregar(html: string): Document {
  const window = new Window({
    url: "https://caixaaqui.caixa.gov.br/caixaaqui/CaixaAquiController/formularios_enviados/formularios_enviados_consulta",
  });
  window.document.write(html);
  return window.document as unknown as Document;
}

const fixture = () =>
  carregar(readFileSync(resolve(raiz, "fixtures/caixa/formularios-enviados-1.html"), "utf8"));

describe("readSentForms", () => {
  it("lê cada linha da tabela pelos títulos das colunas", () => {
    const leitura = readSentForms(fixture());

    expect(leitura?.cpf).toBe("11144477735");
    expect(leitura?.rows).toHaveLength(3);
    expect(leitura?.rows[2]).toEqual({
      proposalNumber: "81234567",
      sentOn: "2026-10-02",
      cpf: "11144477735",
      conformity: "Em análise",
      product: "Habitação",
      riskResult: "APROVADA",
      riskDetails: "Valor máximo de financiamento R$ 280.000,00 - Prestação máxima R$ 2.150,00",
      riskValidUntil: "2027-01-02",
      requestType: "Avaliação de Risco",
    });
  });

  it("traço do portal vira vazio e quebra de linha vira espaço", () => {
    const [preCadastro, cartao] = readSentForms(fixture())!.rows;

    expect(preCadastro?.proposalNumber).toBeNull();
    expect(preCadastro?.conformity).toBe("Pré-Cadastro");
    expect(cartao?.requestType).toBe("Solicitação Contratação");
    expect(cartao?.conformity).toBe("Contratação realizada");
  });

  it("só a linha com resultado, detalhes ou validade conta como avaliação de risco", () => {
    const rows = readSentForms(fixture())!.rows;
    expect(rows.map(hasRiskAssessment)).toEqual([false, false, true]);
  });

  it("acha as colunas mesmo fora da ordem", () => {
    const leitura = readSentForms(
      carregar(`<table><thead><tr>
        <th>Validade da Avaliação de Risco</th><th>No Prop.</th><th>Resultado Da Avaliação De Risco</th>
      </tr></thead><tbody><tr><td>01/02/2027</td><td>123</td><td>REPROVADA</td></tr></tbody></table>`),
    );
    expect(leitura?.rows[0]).toMatchObject({
      proposalNumber: "123",
      riskResult: "REPROVADA",
      riskValidUntil: "2027-02-01",
    });
  });

  it("devolve null em outra tela do portal", () => {
    const outra = readFileSync(resolve(raiz, "fixtures/caixa/cadastro-de-clientes-1.html"), "utf8");
    expect(readSentForms(carregar(outra))).toBeNull();
  });
});
