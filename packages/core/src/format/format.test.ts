import { describe, expect, it } from "vitest";
import { formatCnpj, formatCpf, isValidCnpj, isValidCpf, normalizeCpf } from "./document";
import { formatBRL, parseBRL, parsePercent, toPlainBRL } from "./currency";
import { formatPhone, isValidPhone, normalizePhone } from "./phone";

describe("CPF", () => {
  it("aceita CPF válido com e sem máscara", () => {
    expect(isValidCpf("111.444.777-35")).toBe(true);
    expect(isValidCpf("11144477735")).toBe(true);
  });

  it("rejeita dígito verificador errado, tamanho errado e repetição", () => {
    expect(isValidCpf("111.444.777-36")).toBe(false);
    expect(isValidCpf("1114447773")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("normaliza para dígitos — é o que faz o dedupe de pessoa funcionar", () => {
    expect(normalizeCpf("111.444.777-35")).toBe("11144477735");
    expect(normalizeCpf("111 444 777 35")).toBe("11144477735");
  });

  it("formata para exibição e devolve a entrada quando não dá para formatar", () => {
    expect(formatCpf("11144477735")).toBe("111.444.777-35");
    expect(formatCpf("111")).toBe("111");
  });
});

describe("CNPJ", () => {
  it("valida e formata", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000182")).toBe(false);
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("moeda", () => {
  it("lê os formatos que aparecem em tela de banco", () => {
    expect(parseBRL("R$ 1.234,56")).toBe(123456);
    expect(parseBRL("1.234,56")).toBe(123456);
    expect(parseBRL("1234,56")).toBe(123456);
    expect(parseBRL("R$ 350.000,00")).toBe(35000000);
    expect(parseBRL(1234.56)).toBe(123456);
  });

  it("devolve null para entrada sem número", () => {
    expect(parseBRL("")).toBeNull();
    expect(parseBRL("R$")).toBeNull();
    expect(parseBRL(null)).toBeNull();
  });

  it("sobrevive ao ida e volta sem perder centavo", () => {
    const original = "R$ 1.234.567,89";
    const cents = parseBRL(original);
    expect(cents).toBe(123456789);
    expect(toPlainBRL(cents)).toBe("1234567,89");
    expect(formatBRL(cents).replace(/ /g, " ")).toBe("R$ 1.234.567,89");
  });

  it("guarda percentual em basis points", () => {
    expect(parsePercent("1,25%")).toBe(125);
    expect(parsePercent("10%")).toBe(1000);
  });
});

describe("telefone", () => {
  it("normaliza celular com DDI, DDD e máscara", () => {
    expect(normalizePhone("+55 (11) 91234-5678")).toBe("11912345678");
    expect(normalizePhone("5511912345678")).toBe("11912345678");
    expect(formatPhone("11912345678")).toBe("(11) 91234-5678");
    expect(formatPhone("1132345678")).toBe("(11) 3234-5678");
  });

  it("rejeita tamanho inválido", () => {
    expect(isValidPhone("912345678")).toBe(false);
    expect(isValidPhone("11912345678")).toBe(true);
  });
});
