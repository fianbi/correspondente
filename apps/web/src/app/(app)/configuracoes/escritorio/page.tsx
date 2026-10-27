import type { Metadata } from "next";
import { ORG_ROLE_LABELS, roleAtLeast } from "@corr/core";
import { getOrg, listOrgMembers } from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Escritório" };

export default async function EscritorioPage() {
  const ctx = await requireOrgContext();
  const [org, members] = await Promise.all([getOrg(ctx), listOrgMembers(ctx)]);

  return (
    <>
      <PageHeader title="Escritório" description="Dados usados nos formulários e documentos gerados." />

      <main className="flex max-w-3xl flex-col gap-6 p-6">
        <Card>
          <CardHeader title="Informações" />
          <CardBody>
            <SettingsForm org={org} canEdit={roleAtLeast(ctx.role, "admin")} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Equipe" description={`${members.length} usuário(s) com acesso.`} />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {members.map((member) => (
                <li key={member.userId} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{member.fullName}</p>
                    <p className="truncate text-xs text-ink-muted">{member.email}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted">
                    {ORG_ROLE_LABELS[member.role]}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </main>
    </>
  );
}
