"use client";

import { useActionState, useState, useTransition } from "react";
import { Copy, Mail, Trash2 } from "lucide-react";
import { ORG_ROLES, ORG_ROLE_LABELS, type OrgRole } from "@corr/core";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select, SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  cancelInvite,
  changeMemberRole,
  inviteMember,
  removeTeamMember,
  type InviteState,
} from "./team-actions";

export interface TeamMember {
  userId: string;
  fullName: string;
  email: string;
  role: OrgRole;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: OrgRole;
  /** Já formatada no servidor. */
  expiresAt: string;
}

/** O que cada papel faz, em uma linha, para quem escolhe na hora de convidar. */
const O_QUE_FAZ: Record<OrgRole, string> = {
  operacional: "Trabalha nos processos, pessoas e simulações.",
  analista: "Como o operacional, e também exclui documentos.",
  admin: "Tudo, inclusive excluir processos e pessoas, formulários e equipe.",
  owner: "Como o administrador, e também cuida de outros proprietários.",
};

export function TeamCard({
  members,
  invites,
  currentUserId,
  currentRole,
  canManage,
  baseUrl,
}: {
  members: TeamMember[];
  invites: PendingInvite[];
  currentUserId: string;
  currentRole: OrgRole;
  canManage: boolean;
  baseUrl: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteState, inviteAction] = useActionState<InviteState, FormData>(inviteMember, {});
  const [copied, setCopied] = useState(false);
  // Troca de papel recusada: o select volta para o papel gravado.
  const [versao, setVersao] = useState(0);

  // Só o proprietário dá (ou tira) o papel de proprietário.
  const rolesQuePodeDar = ORG_ROLES.filter((role) => role !== "owner" || currentRole === "owner");
  const opcoes = rolesQuePodeDar.map((role) => ({ value: role, label: ORG_ROLE_LABELS[role] }));
  const link = inviteState.token ? `${baseUrl}/convite/${inviteState.token}` : null;

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result.error) {
        setError(result.error);
        setVersao((v) => v + 1);
      }
    });

  return (
    <Card>
      <CardHeader title="Equipe" description={`${members.length} usuário(s) com acesso.`} />
      <CardBody className="p-0">
        <ul className="divide-y divide-line">
          {members.map((member) => {
            const editavel =
              canManage &&
              member.userId !== currentUserId &&
              (member.role !== "owner" || currentRole === "owner");
            return (
              <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {member.fullName}
                    {member.userId === currentUserId ? (
                      <span className="ml-1.5 text-xs font-normal text-ink-muted">(você)</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-ink-muted">{member.email}</p>
                </div>
                {editavel ? (
                  <div className="flex items-center gap-2">
                    <Select
                      key={`${member.role}-${versao}`}
                      aria-label={`Papel de ${member.fullName}`}
                      options={opcoes}
                      placeholder={null}
                      defaultValue={member.role}
                      disabled={pending}
                      className="h-9 w-40"
                      onChange={(event) => {
                        const role = event.target.value;
                        run(() => changeMemberRole(member.userId, role));
                      }}
                    />
                    <button
                      type="button"
                      aria-label={`Tirar ${member.fullName} da equipe`}
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(`Tirar ${member.fullName} da equipe? O acesso acaba na hora.`)) {
                          run(() => removeTeamMember(member.userId));
                        }
                      }}
                      className="rounded-md p-1.5 text-ink-muted transition hover:bg-surface-muted hover:text-status-reprovado disabled:opacity-40"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted">
                    {ORG_ROLE_LABELS[member.role]}
                  </span>
                )}
              </li>
            );
          })}

          {invites.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Mail className="size-4 shrink-0 text-ink-muted" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{invite.email}</p>
                  <p className="text-xs text-ink-muted">
                    Convite pendente · {ORG_ROLE_LABELS[invite.role]} · vale até {invite.expiresAt}
                  </p>
                </div>
              </div>
              {canManage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => cancelInvite(invite.id))}
                >
                  Cancelar convite
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {error ? (
          <p role="alert" className="border-t border-line px-5 py-3 text-sm text-status-reprovado">
            {error}
          </p>
        ) : null}
      </CardBody>

      {canManage ? (
        <CardBody className="border-t border-line">
          <form action={inviteAction} className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Field label="E-mail de quem vai entrar" name="inviteEmail" type="email" required />
            </div>
            <div className="w-44">
              <SelectField label="Papel" name="inviteRole" options={opcoes} placeholder={null} defaultValue="operacional" />
            </div>
            <SubmitButton size="sm">Gerar convite</SubmitButton>
          </form>
          <ul className="mt-3 space-y-0.5 text-xs text-ink-muted">
            {rolesQuePodeDar.map((role) => (
              <li key={role}>
                <span className="font-medium text-ink">{ORG_ROLE_LABELS[role]}:</span> {O_QUE_FAZ[role]}
              </li>
            ))}
          </ul>

          {inviteState.error ? (
            <p role="alert" className="mt-3 text-sm text-status-reprovado">
              {inviteState.error}
            </p>
          ) : null}

          {link ? (
            <div className="mt-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2">
              <p className="text-xs font-medium text-brand-700">
                Mande este link para {inviteState.email} (WhatsApp ou e-mail). Ele vale por 7 dias,
                uma vez, e só para quem entrar com esse e-mail. Copie agora: o link não aparece de novo.
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="tabular min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-xs text-ink">
                  {link}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(link);
                    setCopied(true);
                  }}
                >
                  <Copy className="size-4" aria-hidden />
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          ) : null}
        </CardBody>
      ) : null}
    </Card>
  );
}
