import type { RiskAssessmentRow } from "@corr/db";
import { cn } from "@/lib/utils";

/** Data ISO (aaaa-mm-dd) como o operador lê. */
export function dataBr(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Venceu antes de hoje. Comparar texto ISO basta: a ordem é a do calendário. */
export function riskExpired(validUntil: string | null, hoje = new Date().toISOString().slice(0, 10)) {
  return validUntil !== null && validUntil < hoje;
}

/**
 * Resultado como o SICAQ escreve, com cor pela palavra. O texto não é
 * traduzido: o operador precisa ver exatamente o que o banco mostrou.
 */
export function RiskResultBadge({ result, validUntil }: { result: string | null; validUntil: string | null }) {
  const texto = (result ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const vencida = riskExpired(validUntil);
  const classe = vencida
    ? "bg-rose-50 text-status-vencido"
    : /reprov|negad|recus/.test(texto)
      ? "bg-red-50 text-status-reprovado"
      : /condicion/.test(texto)
        ? "bg-yellow-50 text-status-condicionado"
        : /aprov/.test(texto)
          ? "bg-green-50 text-status-aprovado"
          : "bg-slate-100 text-status-aberto";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        classe,
      )}
    >
      {result ?? "Sem resultado"}
      {vencida ? " · vencida" : ""}
    </span>
  );
}

/** Linhas de detalhe de uma avaliação, para o card do processo e o da pessoa. */
export function RiskAssessmentDetails({ assessment }: { assessment: RiskAssessmentRow }) {
  const linhas: [string, string][] = [
    ["Proposta", assessment.proposalNumber],
    ["Remessa", dataBr(assessment.sentOn)],
    ["Validade", dataBr(assessment.validUntil)],
    ["Produto", assessment.product ?? "—"],
    ["Conformidade", assessment.conformity ?? "—"],
    ["Tipo de pedido", assessment.requestType ?? "—"],
  ];

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt className="text-xs text-ink-muted">{rotulo}</dt>
            <dd className="text-ink">{valor}</dd>
          </div>
        ))}
      </dl>
      {assessment.details ? (
        <div>
          <p className="text-xs text-ink-muted">Detalhes</p>
          <p className="text-sm whitespace-pre-line text-ink">{assessment.details}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Avaliações extras (CROT, cartão e outros produtos): informam o operador, mas
 * nunca são a avaliação do processo. Uma linha por avaliação basta.
 */
export function RiskExtrasList({
  assessments,
  showPerson = false,
}: {
  assessments: RiskAssessmentRow[];
  showPerson?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {assessments.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
          <RiskResultBadge result={a.result} validUntil={a.validUntil} />
          <span className="text-ink">{a.product ?? "Produto não informado"}</span>
          <span className="text-ink-muted">
            · proposta {a.proposalNumber}
            {a.validUntil ? ` · validade ${dataBr(a.validUntil)}` : ""}
            {showPerson ? ` · ${a.personName}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
