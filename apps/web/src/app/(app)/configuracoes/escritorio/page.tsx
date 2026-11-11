import type { Metadata } from "next";
import { pode } from "@corr/core";
import { getOrg, listOrgMembers, listPendingInvites } from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { enderecoDoSistema } from "@/server/url";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SettingsForm } from "./settings-form";
import { TeamCard } from "./team-card";

export const metadata: Metadata = { title: "Escritório" };

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function EscritorioPage() {
  const ctx = await requireOrgContext();
  const [org, members, invites, baseUrl] = await Promise.all([
    getOrg(ctx),
    listOrgMembers(ctx),
    listPendingInvites(ctx),
    enderecoDoSistema(),
  ]);

  return (
    <>
      <PageHeader title="Escritório" description="Dados usados nos formulários e documentos gerados." />

      <main className="flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
        <Card>
          <CardHeader title="Informações" />
          <CardBody>
            <SettingsForm org={org} canEdit={pode(ctx.role, "gerenciar_escritorio")} />
          </CardBody>
        </Card>

        <TeamCard
          members={members.map((member) => ({
            userId: member.userId,
            fullName: member.fullName,
            email: member.email,
            role: member.role,
          }))}
          invites={invites.map((invite) => ({
            id: invite.id,
            email: invite.email,
            role: invite.role,
            expiresAt: DATA.format(invite.expiresAt),
          }))}
          currentUserId={ctx.userId}
          currentRole={ctx.role}
          canManage={pode(ctx.role, "gerenciar_equipe")}
          baseUrl={baseUrl}
        />
      </main>
    </>
  );
}
