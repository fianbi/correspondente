import { describe, expect, it } from "vitest";
import { DEFAULT_FLOW, validateFlow } from "./default-flow";
import { PROCESS_FIELDS, getField, requireField } from "./catalog";
import { diffFieldValues, parseFieldPatch, splitByStorage } from "./patch";

describe("catálogo de campos", () => {
  it("não tem chave duplicada", () => {
    const keys = PROCESS_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("todo campo de coluna aponta para uma coluna nomeada", () => {
    for (const def of PROCESS_FIELDS) {
      if (def.storage.kind === "column") {
        expect(def.storage.column, def.key).toBeTruthy();
      }
    }
  });

  it("select tem opções fixas ou fonte dinâmica, nunca nenhuma das duas", () => {
    for (const def of PROCESS_FIELDS) {
      if (def.type !== "select" && def.type !== "boolean") continue;
      const temOpcoes = (def.options?.length ?? 0) > 0 || Boolean(def.optionsSource);
      expect(temOpcoes, `${def.key} sem opções`).toBe(true);
    }
  });

  it("requireField estoura em chave desconhecida", () => {
    expect(getField("process.nao_existe")).toBeUndefined();
    expect(() => requireField("process.nao_existe")).toThrow(/desconhecido/i);
  });
});

describe("fluxo padrão", () => {
  it("só referencia campos que existem no catálogo", () => {
    // Este teste é a rede que impede fluxo apontando para campo inexistente
    // virar campo em branco na tela do operador.
    expect(() => validateFlow(DEFAULT_FLOW)).not.toThrow();
  });

  it("tem as seis fases do funil, em ordem", () => {
    expect(DEFAULT_FLOW.stages.map((s) => s.key)).toEqual([
      "cadastro",
      "correspondente",
      "montagem",
      "conformidade_contrato",
      "agencia",
      "cri",
    ]);
  });

  it("nenhum bloco fica vazio", () => {
    for (const stage of DEFAULT_FLOW.stages) {
      expect(stage.blocks.length, stage.key).toBeGreaterThan(0);
      for (const block of stage.blocks) {
        expect(block.fields.length, `${stage.key}/${block.key}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("parseFieldPatch", () => {
  it("normaliza pelo tipo do campo", () => {
    const { values, errors } = parseFieldPatch(
      {
        "process.property_value": "R$ 350.000,00",
        "process.term_months": "360",
        "process.indexer": "  TR  ",
      },
      ["process.property_value", "process.term_months", "process.indexer"],
    );

    expect(errors).toEqual({});
    expect(values["process.property_value"]).toBe(35000000);
    expect(values["process.term_months"]).toBe(360);
    expect(values["process.indexer"]).toBe("TR");
  });

  it("ignora chaves não informadas, para um bloco não apagar os outros", () => {
    const { values } = parseFieldPatch({ "process.indexer": "TR" }, [
      "process.indexer",
      "process.term_months",
    ]);

    expect(Object.keys(values)).toEqual(["process.indexer"]);
  });

  it("reporta erro por campo em vez de derrubar o lote", () => {
    const { values, errors } = parseFieldPatch(
      { "process.bank": "não-é-uuid", "process.indexer": "TR" },
      ["process.bank", "process.indexer"],
    );

    expect(errors["process.bank"]).toBeTruthy();
    expect(values["process.indexer"]).toBe("TR");
  });
});

describe("diffFieldValues", () => {
  it("devolve só o que mudou", () => {
    const changes = diffFieldValues(
      { "process.indexer": "TR", "process.term_months": 360 },
      { "process.indexer": "IPCA", "process.term_months": 360 },
    );

    expect(changes).toEqual([{ key: "process.indexer", from: "TR", to: "IPCA" }]);
  });

  it("trata vazio e nulo como a mesma ausência", () => {
    // Sem isso, abrir e salvar um formulário sem tocar em nada encheria o
    // histórico de "de (vazio) para (vazio)".
    expect(diffFieldValues({ "process.indexer": null }, { "process.indexer": "" })).toEqual([]);
    expect(diffFieldValues({}, { "process.indexer": null })).toEqual([]);
  });

  it("registra preenchimento e apagamento", () => {
    expect(diffFieldValues({}, { "process.indexer": "TR" })).toEqual([
      { key: "process.indexer", from: null, to: "TR" },
    ]);
    expect(diffFieldValues({ "process.indexer": "TR" }, { "process.indexer": null })).toEqual([
      { key: "process.indexer", from: "TR", to: null },
    ]);
  });
});

describe("splitByStorage", () => {
  it("separa coluna nativa de valor guardado", () => {
    const { columns, stored } = splitByStorage({
      "process.property_value": 35000000,
      "credit.installment_value": 250000,
    });

    expect(columns).toEqual({ propertyValueCents: 35000000 });
    expect(stored).toEqual({ "credit.installment_value": 250000 });
  });
});
