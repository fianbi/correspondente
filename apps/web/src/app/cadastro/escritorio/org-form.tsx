"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createOrg, type OrgFormState } from "./actions";

export function OrgForm() {
  const [state, formAction] = useActionState<OrgFormState, FormData>(createOrg, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Nome do escritório" name="name" required autoComplete="organization" />
      <Field label="CNPJ" name="cnpj" inputMode="numeric" placeholder="00.000.000/0001-00" hint="Opcional agora; usado nos formulários dos bancos." />

      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-status-reprovado">
          {state.error}
        </p>
      ) : null}

      <SubmitButton className="w-full">Criar escritório</SubmitButton>
    </form>
  );
}
