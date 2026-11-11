import { describe, expect, it } from "vitest";
import { paginaDaDamp, preencherDamp, type DadosDaDamp } from "./index";
import { participantesDaDamp } from "./participantes";

const dados: DadosDaDamp = {
  pessoa: {
    fullName: "Maria Souza",
    cpf: "52998224725",
    birthDate: "1990-03-07",
    pis: "12056412547",
    maritalStatus: "casado_comunhao_parcial",
    city: "Curitiba",
    uf: "PR",
  },
  rendas: [
    { occupation: "Auxiliar", grossCents: 150000 },
    { occupation: "Professora", grossCents: 420000 },
  ],
  processo: {
    modality: "aquisicao_imovel_usado",
    propertyValueCents: 25000000,
    propertyAddress: "Rua das Flores, 100, 80000-000, Centro",
  },
  escritorio: { city: "Curitiba" },
  hoje: new Date("2026-11-11T01:00:00Z"),
};

describe("DAMP", () => {
  it("preenche cadastro, ocupação, residência, modalidade e assinatura", () => {
    const p = preencherDamp(dados);
    expect(Object.fromEntries(p.textos)).toMatchObject({
      text_nome: "Maria Souza",
      text_data1: "07/03/1990",
      text_cpf: "529.982.247-25",
      text_pis: "120.56412.54-7",
      text_ocupacao: "Professora",
      text_localocupa: "Curitiba",
      text_logradouro: "Curitiba",
      text_uf1: "PR",
      text_enquad1: "R$ 250.000,00",
    });
    expect(p.selecoes).toEqual([
      ["selectEstCiv", "casado"],
      ["selectRegime", "parcial"],
    ]);
    expect(p.cliques).toEqual(["chkocupacao1", "chkresidencia1", "chkusufruto1", "chkmodalidade1"]);
    expect(p.enderecoImovel).toBe("Rua das Flores, 100, 80000-000, Centro");
    // 01h UTC do dia 11 ainda é dia 10 em Brasília.
    expect(p.assinatura).toEqual(["Curitiba", "10", "novembro", "2026"]);
  });

  it("união estável vira solteiro com a opção de união marcada", () => {
    const p = preencherDamp({ ...dados, pessoa: { ...dados.pessoa, maritalStatus: "uniao_estavel" } });
    expect(p.selecoes).toEqual([["selectEstCiv", "solteiro"]]);
    expect(p.cliques[0]).toBe("chkuniaoestavel1");
  });

  it("sem renda, não marca ocupação; modalidade sem opção na DAMP fica em branco", () => {
    const p = preencherDamp({ ...dados, rendas: [], processo: { modality: "aquisicao_terreno" } });
    expect(p.cliques).toEqual(["chkresidencia1", "chkusufruto1"]);
  });

  it("cola o script no fim da página da Caixa, sem quebrar o HTML", async () => {
    const html = paginaDaDamp({ ...dados, pessoa: { ...dados.pessoa, fullName: "</script>Maria" } });
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
    expect(html).toContain("\\u003c/script>Maria");
    expect(html).toContain("data:image/png;base64,");
    if (process.env.SALVAR_PDF) {
      const fs = await import("node:fs");
      fs.writeFileSync(`${process.env.SALVAR_PDF}/damp.html`, paginaDaDamp(dados));
    }
  });

  it("DAMP só para proponentes", () => {
    expect(
      participantesDaDamp({
        personId: "a",
        participants: [
          { personId: "a", fullName: "Maria", role: "proponente" },
          { personId: "b", fullName: "Ana", role: "coproponente" },
          { personId: "c", fullName: "José", role: "conjuge" },
          { personId: "d", fullName: "Pedro", role: "vendedor" },
        ],
      }).map((p) => p.fullName),
    ).toEqual(["Maria", "Ana"]);
  });
});
