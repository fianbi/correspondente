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

  it("só o que mudou vai para a API; sem mudança, nenhuma chamada", () => {
    const comCpf = { ...ESTADO_INICIAL, cpf: CPF, cpfEm: 1000 };
    const tela = { ...ENDERECO, values: { "person.zipCode": "01310100", "person.street": "AV PAULISTA" } };
    const primeiro = decidirEnvio(comCpf, tela, 2000);
    expect(primeiro.envio?.values).toEqual(tela.values);

    // Mesma tela, nada mudou (envio do formulário e saída da página juntos).
    expect(decidirEnvio(primeiro.estado, tela, 2100).envio).toBeNull();

    // Operador trocou só o CEP: vai só o CEP.
    const mudou = { ...tela, values: { ...tela.values, "person.zipCode": "04538133" } };
    expect(decidirEnvio(primeiro.estado, mudou, 2200).envio?.values).toEqual({
      "person.zipCode": "04538133",
    });
  });

  it("lista de rendas vai inteira quando muda, e não vai quando é a mesma", () => {
    const comCpf = { ...ESTADO_INICIAL, cpf: CPF, cpfEm: 1000 };
    const renda = { kind: "informal" as const, sourceName: "CORRETOR", netCents: "1500,00" };
    const tela = { screenKey: "renda_informal", cpf: null, values: {}, incomes: [renda] };
    const primeiro = decidirEnvio(comCpf, tela, 2000);
    expect(primeiro.envio?.incomes).toEqual([renda]);
    expect(decidirEnvio(primeiro.estado, tela, 2100).envio).toBeNull();

    const aumento = { ...tela, incomes: [{ ...renda, netCents: "1800,00" }] };
    expect(decidirEnvio(primeiro.estado, aumento, 2200).envio?.incomes).toHaveLength(1);

    // Lista vazia não apaga nada no sistema: nem chama.
    expect(decidirEnvio(comCpf, { ...tela, incomes: [] }, 2300).envio).toBeNull();
  });

  it("envio que não chegou ao cadastro vai de novo", () => {
    const comCpf = { ...ESTADO_INICIAL, cpf: CPF, cpfEm: 1000 };
    const primeiro = decidirEnvio(comCpf, ENDERECO, 2000);
    const esquecido = esquecerEnvio(primeiro.estado, primeiro.envio!);
    expect(decidirEnvio(esquecido, ENDERECO, 2100).envio?.values).toEqual(ENDERECO.values);
  });

  it("o que se sabe de um CPF não vale para outro", () => {
    const comCpf = { ...ESTADO_INICIAL, cpf: CPF, cpfEm: 1000 };
    const primeiro = decidirEnvio(comCpf, ENDERECO, 2000);
    const outro = decidirEnvio(primeiro.estado, { ...ENDERECO, cpf: "52998224725" }, 2100);
    expect(outro.envio?.values).toEqual(ENDERECO.values);
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
