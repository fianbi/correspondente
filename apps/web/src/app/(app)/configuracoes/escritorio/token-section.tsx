"use client";

import { useActionState, useState, useTransition } from "react";
import { Copy, KeyRound } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { generateApiToken, revokeToken, type TokenState } from "./token-actions";

export interface TokenRow {
  id: string;
  label: string;
  revoked: boolean;
  lastUsedAt: Date | null;
}

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function TokenSection({ tokens }: { tokens: TokenRow[] }) {
  const [state, formAction] = useActionState<TokenState, FormData>(generateApiToken, {});
  const [pending, startTransition] = useTransition();
  const [copiado, setCopiado] = useState(false);

  return (
    <Card>
      <CardHeader
        title="Extensão do navegador"
        description="Token para a extensão preencher as telas do banco com os dados do processo."
      />

      {tokens.length > 0 ? (
        <CardBody className="p-0">
          <ul className="divide-y divide-line">
            {tokens.map((token) => (
              <li key={token.id} className="flex items-center gap-3 px-5 py-3">
                <KeyRound className="size-4 shrink-0 text-ink-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{token.label}</p>
                  <p className="text-xs text-ink-muted">
                    {token.revoked
                      ? "Revogado"
                      : token.lastUsedAt
                        ? `Último uso em ${DATA.format(token.lastUsedAt)}`
                        : "Ainda não usado"}
                  </p>
                </div>
                {token.revoked ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => startTransition(() => void revokeToken(token.id))}
                  >
                    Revogar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardBody>
      ) : null}

      <CardBody className={tokens.length > 0 ? "border-t border-line" : ""}>
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Field label="Identificação" name="label" placeholder="Notebook do escritório" />
          </div>
          <SubmitButton size="sm">Gerar token</SubmitButton>
        </form>

        {state.token ? (
          <div className="mt-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2">
            <p className="text-xs font-medium text-brand-700">
              Copie agora: o sistema guarda só o resumo criptográfico e não mostra de novo.
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-xs text-ink">
                {state.token}
              </code>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(state.token!);
                  setCopiado(true);
                }}
              >
                <Copy className="size-4" aria-hidden />
                {copiado ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
