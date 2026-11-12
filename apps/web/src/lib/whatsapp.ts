/**
 * Celular do cadastro no formato do wa.me: só dígitos, com o 55 do Brasil.
 *
 * O cadastro aceita qualquer máscara, então "(11) 99876-5432", "11998765432"
 * e "+55 11 99876-5432" precisam dar no mesmo número. Devolve null quando não
 * sobra um número que o WhatsApp entenda.
 */
export function celularParaWhatsApp(phone: string | null | undefined): string | null {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  // Zero de discagem interurbana: "011 99876-5432".
  if (digits.length === 12 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!digits.startsWith("55") || digits.length < 12 || digits.length > 13) return null;
  return digits;
}

export function linkDoWhatsApp(phone: string, texto: string): string | null {
  const numero = celularParaWhatsApp(phone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

function primeiroNome(nome: string): string {
  const primeiro = nome.trim().split(/\s+/)[0] ?? "";
  // O cadastro costuma vir em maiúsculas do SICAQ: "MARIA" vira "Maria".
  return primeiro.charAt(0).toLocaleUpperCase("pt-BR") + primeiro.slice(1).toLocaleLowerCase("pt-BR");
}

export function mensagemDeCobranca({
  nome,
  escritorio,
  processNumber,
  etapa,
  documentos,
  pendencias,
}: {
  nome: string;
  escritorio: string;
  processNumber: number;
  etapa: string;
  documentos: { label: string; required: boolean }[];
  pendencias: string[];
}): string {
  const saudacao = nome.trim() ? `Olá, ${primeiroNome(nome)}!` : "Olá!";
  const linhas = [
    `${saudacao} Aqui é do ${escritorio}, sobre o seu financiamento (processo nº ${processNumber}, etapa ${etapa}).`,
  ];

  if (documentos.length > 0) {
    linhas.push("", "Para seguirmos, ainda precisamos destes documentos:");
    for (const doc of documentos) {
      linhas.push(`• ${doc.label}${doc.required ? "" : " (se tiver)"}`);
    }
  }

  if (pendencias.length > 0) {
    linhas.push("", documentos.length > 0 ? "E também:" : "Para seguirmos, falta resolver:");
    for (const pendencia of pendencias) linhas.push(`• ${pendencia}`);
  }

  linhas.push("", "Pode mandar por aqui mesmo, foto legível serve. Qualquer dúvida, é só chamar.");
  return linhas.join("\n");
}
