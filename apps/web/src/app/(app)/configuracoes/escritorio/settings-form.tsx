"use client";

import { useActionState } from "react";
import type { Org } from "@corr/db";
import { formatCnpj } from "@corr/core";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveOrgSettings, type OrgSettingsState } from "./actions";

export function SettingsForm({ org, canEdit }: { org: Org; canEdit: boolean }) {
  const [state, formAction] = useActionState<OrgSettingsState, FormData>(saveOrgSettings, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" name="name" defaultValue={org.name} required />
        <Field
          label="CNPJ"
          name="cnpj"
          defaultValue={org.cnpj ? formatCnpj(org.cnpj) : ""}
          inputMode="numeric"
          placeholder="00.000.000/0001-00"
        />
        <Field
          label="Código do correspondente"
          name="internalCode"
          defaultValue={org.internalCode ?? ""}
          hint="Código junto ao banco, impresso nos formulários."
        />
        <Field label="E-mail" name="email" type="email" defaultValue={org.email ?? ""} />
        <Field label="Telefone" name="phone" defaultValue={org.phone ?? ""} />
        <Field label="Cidade" name="city" defaultValue={org.city ?? ""} />
        <div className="sm:col-span-2">
          <Field label="Endereço" name="addressLine" defaultValue={org.addressLine ?? ""} />
        </div>
      </fieldset>

      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-status-reprovado">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-status-aprovado">
          Dados do escritório atualizados.
        </p>
      ) : null}

      {canEdit ? (
        <div>
          <SubmitButton>Salvar alterações</SubmitButton>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">
          Só administradores podem alterar os dados do escritório.
        </p>
      )}
    </form>
  );
}
