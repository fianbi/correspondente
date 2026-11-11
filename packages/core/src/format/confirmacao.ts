/** Primeiro nome, sem acento e em minúsculas: o que se pede para digitar ao excluir. */
export function nomeParaConfirmar(fullName: string): string {
  return (fullName.trim().split(/\s+/)[0] ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
