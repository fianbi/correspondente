import Link from "next/link";
import type { Metadata, Route } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  NotFoundError,
  PARTICIPANT_ROLE_LABELS,
  formatCpf,
  requireField,
  toFieldView,
  type FieldOption,
} from "@corr/core";
import {
  buildChecklist,
  getFlowForProcess,
  getProcess,
  getProcessFieldValues,
  listAccessLinks,
  listAgencies,
  listBanks,
  listBrokers,
  listOrgMembers,
  listProcessDocuments,
  listProcessEvents,
  listProcessPendencies,
  listRealEstateAgencies,
  listStageStates,
} from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DynamicOptions } from "@/components/fields/field-input";
import { History } from "./history";
import { StageForm, type RenderBlock } from "./stage-form";
import { ProcessHeaderControls } from "./header-controls";
import { DocumentsPanel } from "./documents-panel";
import { PendenciesPanel } from "./pendencies-panel";

export const metadata: Metadata = { title: "Processo" };

type Tab = "etapas" | "documentos" | "pendencias" | "historico";

const TABS: { key: Tab; label: string }[] = [
  { key: "etapas", label: "Etapas" },
  { key: "documentos", label: "Documentos" },
  { key: "pendencias", label: "Pendências" },
  { key: "historico", label: "Histórico" },
];

export default async function ProcessoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ etapa?: string; aba?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const { etapa, aba } = await searchParams;
  const tab: Tab = (TABS.find((t) => t.key === aba)?.key ?? "etapas") as Tab;

  const process = await getProcess(ctx, id).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const [flow, storedValues, stageStates, banks, agencies, brokers, realEstate, members] =
    await Promise.all([
      getFlowForProcess(ctx, process.flowId),
      getProcessFieldValues(ctx, id),
      listStageStates(ctx, id),
      listBanks(),
      listAgencies(ctx),
      listBrokers(ctx),
      listRealEstateAgencies(ctx),
      listOrgMembers(ctx),
    ]);

  const memberOptions: FieldOption[] = members.map((m) => ({
    value: m.userId,
    label: m.fullName,
  }));

  const options: DynamicOptions = {
    banks: banks.map((b) => ({ value: b.id, label: b.shortName })),
    agencies: agencies.map((a) => ({ value: a.id, label: `${a.number} — ${a.name}` })),
    brokers: brokers.map((b) => ({ value: b.id, label: b.name })),
    real_estate_agencies: realEstate.map((a) => ({ value: a.id, label: a.name })),
    members: memberOptions,
  };

  // Nome legível para qualquer id que apareça no histórico (banco, corretor,
  // responsável): o log guarda uuid, o operador precisa ver o nome.
  const relations: Record<string, string> = Object.fromEntries(
    Object.values(options)
      .flat()
      .filter((option): option is FieldOption => Boolean(option))
      .map((option) => [option.value, option.label]),
  );

  const stateByStage = new Map(stageStates.map((s) => [s.stageKey, s]));
  const currentStageKey =
    flow.stages.find((s) => s.key === etapa)?.key ?? process.stage ?? flow.stages[0]?.key;
  const currentStage = flow.stages.find((s) => s.key === currentStageKey) ?? flow.stages[0];

  const [documents, pendencies, links] = await Promise.all([
    listProcessDocuments(ctx, id),
    listProcessPendencies(ctx, id),
    listAccessLinks(ctx, id),
  ]);

  const checklist = await buildChecklist(ctx, id, currentStage?.requirements ?? []);

  const linkRows = links.map((link) => ({
    id: link.id,
    label: link.label,
    canUpload: link.canUpload,
    expired: link.expired,
    revoked: link.revoked,
    accessCount: link.accessCount,
  }));

  // O link do portal precisa da origem real da requisição: em produção é o
  // domínio do escritório, em desenvolvimento é o localhost da máquina.
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const portalBaseUrl = `${protocol}://${host}`;

  const proponent = process.participants.find((p) => p.role === "proponente");

  const blocks: RenderBlock[] = (currentStage?.blocks ?? []).map((block) => ({
    key: block.key,
    title: block.title,
    description: block.description,
    fields: block.fields.map((key) => {
      const def = requireField(key);
      const value =
        def.storage.kind === "column"
          ? ((process as Record<string, unknown>)[def.storage.column] as string | number | null)
          : (storedValues[key] ?? null);
      // `toFieldView` tira o schema Zod: instância de classe não cruza para o cliente.
      return { def: toFieldView(def), value: value ?? null };
    }),
  }));

  const tabHref = (target: Tab) =>
    `/processos/${id}?aba=${target}${currentStage ? `&etapa=${currentStage.key}` : ""}` as Route;

  return (
    <>
      <PageHeader
        title={`Processo #${process.number}`}
        description={proponent ? `${proponent.fullName} · ${formatCpf(proponent.cpf)}` : undefined}
        action={
          <ProcessHeaderControls
            processId={id}
            stage={process.stage}
            status={process.status}
          />
        }
      />

      <main className="flex flex-col gap-5 p-6 lg:flex-row">
        <nav className="lg:w-56 lg:shrink-0" aria-label="Etapas do processo">
          <ol className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {flow.stages.map((stage, index) => {
              const state = stateByStage.get(stage.key)?.state ?? "pendente";
              const active = stage.key === currentStage?.key;
              return (
                <li key={stage.key} className="shrink-0 lg:shrink">
                  <Link
                    href={`/processos/${id}?aba=etapas&etapa=${stage.key}` as Route}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition",
                      active
                        ? "bg-brand-50 font-medium text-brand-700"
                        : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                        state === "concluida"
                          ? "bg-status-aprovado text-white"
                          : state === "em_andamento"
                            ? "bg-status-aguardando text-white"
                            : "bg-surface-muted text-ink-muted",
                      )}
                    >
                      {index + 1}
                    </span>
                    {stage.label}
                  </Link>
                </li>
              );
            })}
          </ol>

        </nav>

        <div className="min-w-0 flex-1">
          {/*
            São links de navegação, não abas de widget: mudam a URL e o
            histórico do navegador. Marcá-los como `role="tab"` mentiria para
            quem usa leitor de tela.
          */}
          <nav
            aria-label="Seções do processo"
            className="mb-4 flex flex-wrap gap-1 border-b border-line pb-2"
          >
            {TABS.map((target) => (
              <Link
                key={target.key}
                href={tabHref(target.key)}
                aria-current={tab === target.key ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition",
                  tab === target.key
                    ? "bg-brand-50 font-medium text-brand-700"
                    : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                )}
              >
                {target.label}
              </Link>
            ))}
          </nav>

          {tab === "historico" ? (
            <HistoryTab processId={id} actors={members} relations={relations} />
          ) : tab === "documentos" ? (
            <DocumentsPanel
              processId={id}
              stageKey={currentStage?.key ?? null}
              documents={documents}
              checklist={checklist}
            />
          ) : tab === "pendencias" ? (
            <PendenciesPanel
              processId={id}
              stageKey={currentStage?.key ?? null}
              pendencies={pendencies}
              links={linkRows}
              portalBaseUrl={portalBaseUrl}
            />
          ) : currentStage ? (
            <StageForm
              processId={id}
              stageKey={currentStage.key}
              stageLabel={currentStage.label}
              blocks={blocks}
              options={options}
              state={stateByStage.get(currentStage.key)?.state ?? "pendente"}
              assignedTo={stateByStage.get(currentStage.key)?.assignedTo ?? null}
              members={memberOptions}
            />
          ) : null}

          {tab === "etapas" ? (
          <Card className="mt-5">
            <CardHeader title="Pessoas do processo" />
            <CardBody className="p-0">
              <ul className="divide-y divide-line">
                {process.participants.map((participant) => (
                  <li
                    key={`${participant.personId}-${participant.role}`}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/pessoas/${participant.personId}` as Route}
                        className="text-sm font-medium text-ink hover:text-brand-600 hover:underline"
                      >
                        {participant.fullName}
                      </Link>
                      <p className="text-xs text-ink-muted">{formatCpf(participant.cpf)}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted">
                      {PARTICIPANT_ROLE_LABELS[participant.role]}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          ) : null}
        </div>
      </main>
    </>
  );
}

async function HistoryTab({
  processId,
  actors,
  relations,
}: {
  processId: string;
  actors: { userId: string; fullName: string }[];
  relations: Record<string, string>;
}) {
  const ctx = await requireOrgContext();
  const events = await listProcessEvents(ctx, processId);

  return (
    <History
      events={events}
      actors={Object.fromEntries(actors.map((a) => [a.userId, a.fullName]))}
      relations={relations}
    />
  );
}
