"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Copy, Link2, RotateCcw } from "lucide-react";
import { PENDENCY_STATUS_LABELS } from "@corr/core";
import type { PendencyRow } from "@corr/db";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { addPendency, generateAccessLink, revokeLink, togglePendency } from "./document-actions";

export interface AccessLinkRow {
  id: string;
  label: string;
  canUpload: boolean;
  /** Calculado no servidor: comparar datas no render do cliente é impuro. */
  expired: boolean;
  revoked: boolean;
  accessCount: number;
}

export function PendenciesPanel({
  processId,
  stageKey,
  pendencies,
  links,
  portalBaseUrl,
}: {
  processId: string;
  stageKey: string | null;
  pendencies: PendencyRow[];
  links: AccessLinkRow[];
  portalBaseUrl: string;
}) {
  const [pending, startTransition] = useTransition();
  const [pendencyState, pendencyAction] = useActionState<{ error?: string }, FormData>(
    addPendency.bind(null, processId, stageKey),
    {},
  );
  const [linkState, linkAction] = useActionState<{ token?: string; error?: string }, FormData>(
    generateAccessLink.bind(null, processId),
    {},
  );
  const [copied, setCopied] = useState(false);

  const novoLink = linkState.token ? `${portalBaseUrl}/p/${linkState.token}` : null;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Pendências" description="O que falta para o processo andar." />
        {pendencies.length > 0 ? (
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {pendencies.map((pendency) => (
                <li key={pendency.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        pendency.status === "resolvida"
                          ? "text-ink-muted line-through"
                          : "text-ink",
                      )}
                    >
                      {pendency.title}
                    </p>
                    {pendency.description ? (
                      <p className="text-xs text-ink-muted">{pendency.description}</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {PENDENCY_STATUS_LABELS[pendency.status]}
                      {pendency.createdByName ? ` · aberta por ${pendency.createdByName}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={
                      pendency.status === "aberta" ? "Marcar como resolvida" : "Reabrir pendência"
                    }
                    onClick={() =>
                      startTransition(() =>
                        void togglePendency(processId, pendency.id, pendency.status === "aberta"),
                      )
                    }
                    className="shrink-0 rounded-md p-1.5 text-ink-muted transition hover:bg-surface-muted hover:text-ink disabled:opacity-40"
                  >
                    {pendency.status === "aberta" ? (
                      <Check className="size-4" aria-hidden />
                    ) : (
                      <RotateCcw className="size-4" aria-hidden />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>
        ) : null}

        <CardBody className={pendencies.length > 0 ? "border-t border-line" : ""}>
          <form action={pendencyAction} className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Label htmlFor="pendency-title">Nova pendência</Label>
              <Input id="pendency-title" name="title" placeholder="Falta comprovante de renda atualizado" />
            </div>
            <SubmitButton size="sm">Adicionar</SubmitButton>
            {pendencyState.error ? (
              <p role="alert" className="w-full text-sm text-status-reprovado">
                {pendencyState.error}
              </p>
            ) : null}
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Links de acesso"
          description="Para o cliente ou o corretor acompanhar e enviar documentos, sem criar conta."
        />

        {links.length > 0 ? (
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {links.map((link) => {
                const inativo = link.revoked || link.expired;
                return (
                  <li key={link.id} className="flex items-center gap-3 px-5 py-3">
                    <Link2 className="size-4 shrink-0 text-ink-muted" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium", inativo ? "text-ink-muted" : "text-ink")}>
                        {link.label}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {link.revoked
                          ? "Revogado"
                          : link.expired
                            ? "Expirado"
                            : link.accessCount === 0
                              ? "Ainda não acessado"
                              : `${link.accessCount} acesso(s)`}
                        {link.canUpload ? " · pode enviar documentos" : " · somente leitura"}
                      </p>
                    </div>
                    {inativo ? null : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => startTransition(() => void revokeLink(processId, link.id))}
                      >
                        Revogar
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        ) : null}

        <CardBody className={links.length > 0 ? "border-t border-line" : ""}>
          <form action={linkAction} className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <Field label="Para quem é o link" name="label" placeholder="Cliente — Ana Paula" />
            </div>
            <div className="w-32">
              <Field
                label="Validade (dias)"
                name="expiresInDays"
                defaultValue="30"
                inputMode="numeric"
              />
            </div>
            <label className="flex items-center gap-2 pb-2.5 text-sm text-ink">
              <input type="checkbox" name="canUpload" defaultChecked className="size-4" />
              Pode enviar documentos
            </label>
            <SubmitButton size="sm">Gerar link</SubmitButton>
          </form>

          {linkState.error ? (
            <p role="alert" className="mt-3 text-sm text-status-reprovado">
              {linkState.error}
            </p>
          ) : null}

          {novoLink ? (
            <div className="mt-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2">
              <p className="text-xs font-medium text-brand-700">
                Copie agora: por segurança, o link completo não é exibido de novo.
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="tabular min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-xs text-ink">
                  {novoLink}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(novoLink);
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
      </Card>
    </div>
  );
}
