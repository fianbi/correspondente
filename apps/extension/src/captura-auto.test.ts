import { describe, expect, it } from "vitest";
import {
  decidirEnvio,
  esquecerEnvio,
  ESTADO_INICIAL,
  saiuDoCadastro,
  VALIDADE_DO_CPF_MS,
} from "./captura-auto";

const CPF = "11144477735";
const ENDERECO = {
  screenKey: "cadastro_endereco",
  cpf: null,
  values: { "person.zipCode": "01310100" },
  incomes: [],
};

describe("decidirEnvio", () => {
  it("sem CPF na tela nem na sessão, nada é enviado", () => {
    expect(decidirEnvio(ESTADO_INICIAL, ENDERECO, 1000).envio).toBeNull();
  });

  it("a entrada do CPF só abre a sessão; a tela seguinte vai para esse CPF", () => {
    const entrada = decidirEnvio(ESTADO_INICIAL, { screenKey: null, cpf: CPF, values: {}, incomes: [] }, 1000);
    expect(entrada.envio).toBeNull();
    expect(entrada.estado.cpf).toBe(CPF);

    const endereco = decidirEnvio(entrada.estado, ENDERECO, 2000);
    expect(endereco.envio).toMatchObject({ cpf: CPF, screenKey: "cadastro_endereco" });
  });

  it("o mesmo conteúdo não vai duas vezes", () => {
    const comCpf = { ...ESTADO_INICIAL, cpf: CPF, cpfEm: 1000 };
    const primeiro = decidirEnvio(comCpf, ENDERECO, 2000);
    expect(primeiro.envio).not.toBeNull();
    expect(decidirEnvio(primeiro.estado, ENDERECO, 2100).envio).toBeNull();

    // Conteúdo mudou: é um envio novo.
    const mudou = { ...ENDERECO, values: { "person.zipCode": "04538133" } };
    expect(decidirEnvio(primeiro.estado, mudou, 2200).envio).not.toBeNull();
  });

  it("envio que falhou pode ir de novo", () => {
    const comCpf = { ...ESTADO_INICIAL, cpf: CPF, cpfEm: 1000 };
    const primeiro = decidirEnvio(comCpf, ENDERECO, 2000);
    const esquecido = esquecerEnvio(primeiro.estado, primeiro.envio!.chave);
    expect(decidirEnvio(esquecido, ENDERECO, 2100).envio).not.toBeNull();
  });

  it("CPF novo na tela substitui o da sessão", () => {
    const comCpf = { ...ESTADO_INICIAL, cpf: CPF, cpfEm: 1000 };
    const outro = decidirEnvio(comCpf, { screenKey: null, cpf: "52998224725", values: {}, incomes: [] }, 2000);
    expect(decidirEnvio(outro.estado, ENDERECO, 3000).envio?.cpf).toBe("52998224725");
  });

  it("CPF parado há mais de uma hora não vale mais", () => {
    const comCpf = { ...ESTADO_INICIAL, cpf: CPF, cpfEm: 1000 };
    expect(decidirEnvio(comCpf, ENDERECO, 1000 + VALIDADE_DO_CPF_MS + 1).envio).toBeNull();
  });
});

describe("saiuDoCadastro", () => {
  const BASE = "https://caixaaqui.caixa.gov.br/caixaaqui/CaixaAquiController";
  const noTopo = { ...ESTADO_INICIAL, cpf: CPF, cpfEm: 1000, cpfNoTopo: true };

  it("navegar entre telas do cadastro mantém o CPF", () => {
    expect(saiuDoCadastro(noTopo, `${BASE}/cadastro_cliente/cadastro_cliente3`)).toBe(false);
  });

  it("sair do cadastro esquece o CPF", () => {
    expect(saiuDoCadastro(noTopo, `${BASE}/menu_negocios`)).toBe(true);
  });

  it("CPF vindo de frame não depende da URL da aba", () => {
    expect(saiuDoCadastro({ ...noTopo, cpfNoTopo: false }, `${BASE}/menu_negocios`)).toBe(false);
  });
});
