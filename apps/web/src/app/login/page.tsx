import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "./auth-form";
import { signIn } from "./actions";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Correspondente</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Entrar na sua conta</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Gestão de processos de crédito imobiliário do seu escritório.
        </p>
      </div>

      <AuthForm action={signIn} mode="login" next={next} />

      <p className="text-sm text-ink-muted">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-brand-600 hover:underline">
          Criar conta
        </Link>
      </p>
    </main>
  );
}
