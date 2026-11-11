import type { Metadata } from "next";
import { listAgencies, listBanks } from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { PageHeader } from "@/components/shell/page-header";
import { AgenciesPanel } from "./agencies-panel";

export const metadata: Metadata = { title: "Agências" };

export default async function AgenciasPage() {
  const ctx = await requireOrgContext();
  const [agencies, banks] = await Promise.all([listAgencies(ctx), listBanks()]);
  const caixa = banks.find((bank) => bank.code === "104");

  return (
    <>
      <PageHeader
        title="Agências"
        description="As agências com que o escritório trabalha. No processo, a agência é escolhida desta lista."
      />

      <main className="max-w-4xl p-4 sm:p-6">
        <AgenciesPanel
          banks={banks.map((bank) => ({ value: bank.id, label: bank.shortName }))}
          defaultBankId={caixa?.id ?? banks[0]?.id ?? ""}
          agencies={agencies.map((agency) => ({
            id: agency.id,
            bankId: agency.bankId,
            bankShortName: agency.bankShortName,
            number: agency.number,
            name: agency.name,
            city: agency.city,
            uf: agency.uf,
            email: agency.email,
            phone: agency.phone,
            processCount: Number(agency.processCount),
          }))}
        />
      </main>
    </>
  );
}
