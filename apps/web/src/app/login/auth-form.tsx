"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { AuthFormState } from "./actions";

type Action = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;

export function AuthForm({
  action,
  mode,
  next,
}: {
  action: Action;
  mode: "login" | "cadastro";
  next?: string;
}) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {mode === "cadastro" ? (
        <Field label="Nome completo" name="fullName" autoComplete="name" required />
      ) : null}

      <Field label="E-mail" name="email" type="email" autoComplete="email" required />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        required
        hint={mode === "cadastro" ? "Mínimo de 8 caracteres." : undefined}
      />

      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-status-reprovado">
          {state.error}
        </p>
      ) : null}

      <SubmitButton className="w-full">
        {mode === "login" ? "Entrar" : "Criar conta"}
      </SubmitButton>
    </form>
  );
}
