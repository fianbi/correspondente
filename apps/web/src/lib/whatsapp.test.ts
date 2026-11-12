import { describe, expect, it } from "vitest";
import { celularParaWhatsApp, linkDoWhatsApp, mensagemDeCobranca } from "./whatsapp";

describe("celular para o WhatsApp", () => {
  it("aceita qualquer máscara do cadastro e põe o 55", () => {
    expect(celularParaWhatsApp("(11) 99876-5432")).toBe("5511998765432");
    expect(celularParaWhatsApp("+55 11 99876-5432")).toBe("5511998765432");
    expect(celularParaWhatsApp("011 99876-5432")).toBe("5511998765432");
    expect(celularParaWhatsApp("(48) 3222-1100")).toBe("554832221100");
  });

  it("recusa o que não é número de telefone", () => {
    expect(celularParaWhatsApp(null)).toBeNull();
    expect(celularParaWhatsApp("99876")).toBeNull();
    expect(celularParaWhatsApp("1234 5678 9012 345")).toBeNull();
  });

  it("monta o link com o texto codificado", () => {
    expect(linkDoWhatsApp("11998765432", "Olá, tudo bem?")).toBe(
      "https://wa.me/5511998765432?text=Ol%C3%A1%2C%20tudo%20bem%3F",
    );
  });
});

describe("mensagem de cobrança", () => {
  it("lista documentos e pendências com o primeiro nome do cliente", () => {
    const texto = mensagemDeCobranca({
      nome: "MARIA DA SILVA",
      escritorio: "Bitt Correspondente",
      processNumber: 42,
      etapa: "Documentação pessoal",
      documentos: [
        { label: "RG", required: true },
        { label: "Certidão de casamento", required: false },
      ],
      pendencias: ["Assinar a DAMP"],
    });
    expect(texto).toContain("Olá, Maria!");
    expect(texto).toContain("processo nº 42, etapa Documentação pessoal");
    expect(texto).toContain("• RG\n• Certidão de casamento (se tiver)");
    expect(texto).toContain("E também:\n• Assinar a DAMP");
  });

  it("só pendência, sem documento", () => {
    const texto = mensagemDeCobranca({
      nome: "",
      escritorio: "X",
      processNumber: 1,
      etapa: "Análise",
      documentos: [],
      pendencias: ["Atualizar renda"],
    });
    expect(texto.startsWith("Olá! ")).toBe(true);
    expect(texto).toContain("Para seguirmos, falta resolver:\n• Atualizar renda");
  });
});
