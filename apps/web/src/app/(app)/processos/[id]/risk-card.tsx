"use client";

import { useState, useTransition } from "react";
import type { RiskAssessmentRow } from "@corr/db";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  RiskAssessmentDetails,
  RiskResultBadge,
  dataBr,
} from "@/components/risk/risk-assessment";
import { linkRiskAssessmentAction } from "./risk-actions";

/**
 * Avaliação de risco do SICAQ que vale para o processo.
 *
 * Quem preenche é a extensão, ao abrir "Formulários Enviados" no Caixa Aqui:
 * a avaliação vigente entra sozinha no processo que ainda não tem nenhuma. O
 * seletor serve para quando o cliente tem mais de uma e a certa é outra.
 */
export function RiskCard({
  processId,
  linkedId,
  assessments,
  showPerson,
}: {
  processId: string;
  linkedId: string | null;
  assessments: RiskAssessmentRow[];
  /** Mais de uma pessoa no processo: o seletor diz de quem é cada avaliação. */
  showPerson: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const vinculada = assessments.find((a) => a.id === linkedId) ?? null;

  const opcoes = assessments.map((a) => ({
    value: a.id,
    label: [
      `Proposta ${a.proposalNumber}`,
      a.result ?? "sem resultado",
      a.validUntil ? `validade ${dataBr(a.validUntil)}` : null,
      showPerson ? a.personName : null,
    ]
      .filter(Boolean)
      .join(" · "),
  }));

  return (
    <Card className="mb-5">
      <CardHeader
        title="Avaliação de risco"
        description={
          assessments.length === 0
            ? "Nenhuma avaliação capturada. Abra \"Formulários Enviados\" no Caixa Aqui com o CPF do cliente e a extensão traz para cá."
            : vinculada
              ? undefined
              : "O processo ainda não tem avaliação vinculada."
        }
        action={vinculada ? <RiskResultBadge result={vinculada.result} validUntil={vinculada.validUntil} /> : null}
      />
      {assessments.length > 0 ? (
        <CardBody className="flex flex-col gap-4">
          {vinculada ? <RiskAssessmentDetails assessment={vinculada} /> : null}
          <div className="flex flex-col gap-1 sm:max-w-md">
            <label htmlFor="avaliacao-risco" className="text-xs text-ink-muted">
              Avaliação vinculada ao processo
            </label>
            <Select
              id="avaliacao-risco"
              className="h-9 text-sm"
              placeholder="Nenhuma"
              options={opcoes}
              value={linkedId ?? ""}
              disabled={pending}
              onChange={(event) => {
                const escolhida = event.target.value;
                setErro(null);
                startTransition(async () => {
                  const resultado = await linkRiskAssessmentAction(processId, escolhida);
                  if (resultado.error) setErro(resultado.error);
                });
              }}
            />
            {erro ? <p className="text-xs text-status-reprovado">{erro}</p> : null}
          </div>
        </CardBody>
      ) : null}
    </Card>
  );
}
