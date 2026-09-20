import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/app/login/auth-form";
import { signUp } from "@/app/login/actions";

export const metadata: Metadata = { title: "Criar conta" };

export default function CadastroPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Correspondente</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Criar sua conta</h1>
        <p className="mt-1 text-sm text-ink-muted">
          No passo seguinte você cadastra o escritório.
        </p>
      </div>

      <AuthForm action={signUp} mode="cadastro" />

      <p className="text-sm text-ink-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
