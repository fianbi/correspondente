import { NotFoundError, resolveCurrentStep, stepsForModality } from "@corr/core";
import { getOrg, getProcess, listAgencies, listBanks, listBrokers } from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { gerarResumoPdf } from "@/server/pdf/resumo";

/**
 * Resumo do processo em PDF.
 *
 * Rota de servidor em vez de geração no cliente: o PDF carrega dados do
 * escritório e dos proponentes, e montá-lo no navegador exigiria mandar tudo
 * isso para lá sem necessidade.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext();
  const { id } = await params;

  try {
    const [process, org] = await Promise.all([getProcess(ctx, id), getOrg(ctx)]);
    const [banks, agencies, brokers] = await Promise.all([
      listBanks(),
      listAgencies(ctx),
      listBrokers(ctx),
    ]);

    const pdf = await gerarResumoPdf({
      org: {
        name: org.name,
        cnpj: org.cnpj,
        internalCode: org.internalCode,
        email: org.email,
        phone: org.phone,
        city: org.city,
        addressLine: org.addressLine,
      },
      process: {
        number: process.number,
        step: resolveCurrentStep(stepsForModality(process.modality), process.stepKey, process.stage).label,
        status: process.status,
        modality: process.modality,
        indexer: process.indexer,
        amortization: process.amortizationSystem,
        contractNumber: process.contractNumber,
        proposalNumber: process.proposalNumber,
        propertyValueCents: process.propertyValueCents,
        financedValueCents: process.financedValueCents,
        approvedValueCents: process.approvedValueCents,
        subsidyCents: process.subsidyCents,
        fgtsCents: process.fgtsCents,
        termMonths: process.termMonths,
        creditValidUntil: process.creditValidUntil,
        propertyAddress: process.propertyAddress,
        propertyRegistration: process.propertyRegistration,
        bankName: banks.find((b) => b.id === process.bankId)?.name ?? null,
        agencyName: agencies.find((a) => a.id === process.agencyId)?.name ?? null,
        brokerName: brokers.find((b) => b.id === process.brokerId)?.name ?? null,
        createdAt: process.createdAt,
      },
      participants: process.participants,
    });

    return new Response(pdf as BodyInit, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="processo-${process.number}.pdf"`,
        // Resumo reflete o estado de agora: guardar em cache entregaria uma
        // foto velha do processo na próxima abertura.
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) return new Response("Processo não encontrado.", { status: 404 });
    throw error;
  }
}
