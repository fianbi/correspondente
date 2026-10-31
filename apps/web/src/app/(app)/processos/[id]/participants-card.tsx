"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  OTHER_PARTICIPANT_ROLES,
  PARTICIPANT_ROLE_LABELS,
  formatCpf,
  type ParticipantRole,
} from "@corr/core";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select, type SelectOption } from "@/components/ui/select";
import { addParticipantAction, removeParticipantAction } from "../actions";

const CHOICES: SelectOption[] = [
  { value: "proponente", label: "Proponente" },
  ...OTHER_PARTICIPANT_ROLES.map((role) => ({ value: role, label: PARTICIPANT_ROLE_LABELS[role] })),
];

/**
 * Quem participa do processo. Proponente que entra ou sai reordena a lista:
 * o principal é sempre o de maior renda, sem ninguém precisar escolher.
 */
export function ParticipantsCard({
  processId,
  participants,
  people,
}: {
  processId: string;
  participants: { personId: string; fullName: string; cpf: string; role: ParticipantRole }[];
  people: SelectOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState("vendedor");
  const [personId, setPersonId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await action();
      setError(result.error ?? null);
      if (!result.error) {
        setAdding(false);
        setPersonId("");
      }
    });

  return (
    <Card className="mt-5">
      <CardHeader
        title="Participantes"
        action={
          adding ? null : (
            <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden />
              Adicionar participante
            </Button>
          )
        }
      />
      <CardBody className="p-0">
        <ul className="divide-y divide-line">
          {participants.map((participant) => (
            <li
              key={`${participant.personId}-${participant.role}`}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/pessoas/${participant.personId}` as Route}
                  className="text-sm font-medium text-ink hover:text-brand-600 hover:underline"
                >
                  {participant.fullName}
                </Link>
                <p className="text-xs text-ink-muted">{formatCpf(participant.cpf)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted">
                  {PARTICIPANT_ROLE_LABELS[participant.role]}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  aria-label={`Remover ${participant.fullName} (${PARTICIPANT_ROLE_LABELS[participant.role]})`}
                  onClick={() =>
                    run(() => removeParticipantAction(processId, participant.personId, participant.role))
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {adding ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
            <Select
              aria-label="Papel"
              className="w-56"
              placeholder={null}
              options={CHOICES}
              value={choice}
              onChange={(event) => setChoice(event.target.value)}
            />
            <Select
              aria-label="Pessoa"
              className="min-w-0 flex-1"
              placeholder="Selecione a pessoa"
              options={people}
              value={personId}
              onChange={(event) => setPersonId(event.target.value)}
            />
            <Button
              type="button"
              size="sm"
              disabled={pending || !personId}
              onClick={() => run(() => addParticipantAction(processId, personId, choice))}
            >
              Incluir
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="border-t border-line px-5 py-3 text-sm text-status-reprovado">
            {error}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
