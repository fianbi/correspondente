/**
 * Quem recebe DAMP no processo: os proponentes. Processo antigo sem a lista
 * de participantes cai no titular.
 */
export function participantesDaDamp(process: {
  personId: string;
  participants: { personId: string; fullName: string; role: string }[];
}): { personId: string; fullName: string }[] {
  const proponentes = process.participants.filter(
    (p) => p.role === "proponente" || p.role === "coproponente",
  );
  if (proponentes.length > 0) return proponentes;
  const titular = process.participants.find((p) => p.personId === process.personId);
  return titular ? [titular] : [];
}
