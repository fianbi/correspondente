import Link from "next/link";
import type { Metadata } from "next";
import { ORG_ROLE_LABELS } from "@corr/core";
import { findInvite } from "@corr/db";
import { requireSessionUser } from "@/server/session";
import { AcceptButton } from "./accept-button";

export const metadata: Metadata = {
  title: "Convite",
  robots: { index: false, follow: false },
};

/**
 * Página do link de convite. Sem sessão, o middleware manda para o login com
 * a volta para cá (e de lá dá para criar a conta). Com sessão, mostra o
 * convite e o botão de aceitar.
 */
export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await requireSessionUser();
  const invite = await findInvite(token);

  const problema = !invite
    ? "Este link de convite não existe. Confira se copiou o link inteiro."
    : invite.problema === "aceito"
      ? "Este convite já foi usado."
      : invite.problema === "cancelado"
        ? "Este convite foi cancelado. Peça um novo a quem convidou."
        : invite.problema === "vencido"
          ? "Este convite venceu. Peça um novo a quem convidou."
          : null;

  const outroEmail = invite && !problema && invite.email !== user.email.trim().toLowerCase();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Correspondente</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">
          {invite && !problema ? `Convite de ${invite.orgName}` : "Convite"}
        </h1>
      </div>

      {problema ? (
        <p className="text-sm text-ink">{problema}</p>
      ) : outroEmail ? (
        <div className="flex flex-col gap-3 text-sm text-ink">
          <p>
            Este convite é para <strong>{invite!.email}</strong>, mas você entrou como{" "}
            <strong>{user.email}</strong>.
          </p>
          <form action="/auth/sair" method="post">
            <input type="hidden" name="next" value={`/convite/${token}`} />
            <button type="submit" className="font-medium text-brand-600 hover:underline">
              Sair e entrar com {invite!.email}
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink">
            Você foi convidado para a equipe de <strong>{invite!.orgName}</strong> como{" "}
            <strong>{ORG_ROLE_LABELS[invite!.role]}</strong>.
          </p>
          <AcceptButton token={token} />
        </div>
      )}

      <Link href="/painel" className="text-sm text-ink-muted hover:underline">
        Ir para o sistema
      </Link>
    </main>
  );
}
