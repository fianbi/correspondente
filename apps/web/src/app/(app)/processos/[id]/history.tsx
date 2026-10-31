import {
  PROCESS_STAGE_LABELS,
  PROCESS_STATUS_LABELS,
  formatFieldValue,
  getField,
  stepLabel,
  type ProcessStage,
  type ProcessStatus,
} from "@corr/core";
import type { ProcessEvent } from "@corr/db";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

/** Resolve o nome de quem fez a alteração; `null` vira "sistema". */
export type ActorNames = Record<string, string>;

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" });
const TIME = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

function describe(event: ProcessEvent, resolveRelation: (value: string | null) => string) {
  switch (event.kind) {
    case "processo_criado":
      return { label: "Processo criado", from: null, to: `#${event.newValue}` };
    case "fase_alterada":
      return {
        label: "Fase",
        from: PROCESS_STAGE_LABELS[event.oldValue as ProcessStage] ?? event.oldValue,
        to: PROCESS_STAGE_LABELS[event.newValue as ProcessStage] ?? event.newValue,
      };
    case "andamento_alterado":
      return {
        label: "Etapa",
        from: stepLabel(event.oldValue),
        to: stepLabel(event.newValue),
      };
    case "status_alterado":
      return {
        label: "Status",
        from: PROCESS_STATUS_LABELS[event.oldValue as ProcessStatus] ?? event.oldValue,
        to: PROCESS_STATUS_LABELS[event.newValue as ProcessStatus] ?? event.newValue,
      };
    case "etapa_iniciada":
      return { label: "Etapa iniciada", from: null, to: stageLabel(event.newValue) };
    case "etapa_finalizada":
      return { label: "Etapa finalizada", from: null, to: stageLabel(event.newValue) };
    case "avaliacao_risco_vinculada":
      return {
        label: "Avaliação de risco",
        from: event.oldValue ? `Proposta ${event.oldValue}` : null,
        to: event.newValue ? `Proposta ${event.newValue}` : "Nenhuma",
      };
    case "responsavel_alterado":
      return {
        label: `Responsável — ${stageLabel(event.fieldKey)}`,
        from: null,
        to: resolveRelation(event.newValue),
      };
    default: {
      const def = event.fieldKey ? getField(event.fieldKey) : undefined;
      const format = (raw: string | null) =>
        def?.optionsSource ? resolveRelation(raw) : formatFieldValue(def, raw);
      return {
        label: def?.label ?? event.fieldKey ?? "Campo",
        from: format(event.oldValue),
        to: format(event.newValue),
      };
    }
  }
}

const stageLabel = (key: string | null) =>
  key ? (PROCESS_STAGE_LABELS[key as ProcessStage] ?? key) : "—";

/**
 * Histórico agrupado por dia, com o "de → para" de cada alteração.
 *
 * É só leitura de `process_events`: como toda escrita passa por
 * `applyProcessPatch`, não existe alteração que não apareça aqui.
 */
export function History({
  events,
  actors,
  relations,
}: {
  events: ProcessEvent[];
  actors: ActorNames;
  relations: Record<string, string>;
}) {
  if (events.length === 0) {
    return (
      <Card>
        <CardBody className="text-sm text-ink-muted">
          Nenhuma alteração registrada ainda.
        </CardBody>
      </Card>
    );
  }

  const resolveRelation = (value: string | null) =>
    value === null || value === "" ? "—" : (relations[value] ?? value);

  const byDay = new Map<string, ProcessEvent[]>();
  for (const event of events) {
    const day = DATE.format(event.createdAt);
    const list = byDay.get(day) ?? [];
    list.push(event);
    byDay.set(day, list);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...byDay.entries()].map(([day, dayEvents]) => (
        <Card key={day}>
          <CardHeader title={day} />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {dayEvents.map((event) => {
                const info = describe(event, resolveRelation);
                return (
                  <li key={event.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-5 py-2.5 text-sm">
                    <span className="tabular w-12 shrink-0 text-xs text-ink-muted">
                      {TIME.format(event.createdAt)}
                    </span>
                    <span className="font-medium text-ink">{info.label}</span>
                    {info.from ? (
                      <>
                        <span className="text-ink-muted line-through">{info.from}</span>
                        <span className="text-ink-muted" aria-label="para">
                          →
                        </span>
                      </>
                    ) : null}
                    <span className="text-ink">{info.to ?? "—"}</span>
                    <span className="ml-auto text-xs text-ink-muted">
                      {event.actorId ? (actors[event.actorId] ?? "Usuário") : "Sistema"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
