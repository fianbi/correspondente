import Link from "next/link";
import type { Metadata, Route } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import {
  NotFoundError,
  PARTICIPANT_ROLE_LABELS,
  STEP_TRACKS,
  detoursFrom,
  formatCpf,
  nextStep,
  requireField,
  resolveCurrentStep,
  stepsForModality,
  trackForModality,
  toFieldView,
  type FieldOption,
  type ProcessStepDef,
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
  listFormTemplates,
  listProcessPendencies,
  listRealEstateAgencies,
  listRiskAssessmentsForPeople,
  listStageStates,
  listPeople,
  listVisitedSteps,
} from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DynamicOptions } from "@/components/fields/field-input";
import { History } from "./history";
import { StageForm, type RenderBlock, type StepState } from "./stage-form";
import { ProcessHeaderControls } from "./header-controls";
import { ProcessDocuments } from "./process-documents";
import { DocumentsPanel } from "./documents-panel";
import { PendenciesPanel } from "./pendencies-panel";
import { RiskCard } from "./risk-card";
import { StepActions } from "./step-progress";
import { ParticipantsCard } from "./participants-card";

export const metadata: Metadata = { title: "Processo" };

type Tab = "etapas" | "documentos" | "pendencias" | "historico";

const TABS: { key: Tab; label: string }[] = [
  { key: "etapas", label: "Dados da etapa" },
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

  const stateByStep = new Map(stageStates.map((s) => [s.stageKey, s]));

  // Etapa atual (onde o processo está) e etapa aberta na tela (a que o
  // operador clicou). A tela de campos e o checklist vêm do grupo da etapa
  // aberta no fluxo do escritório.
  const steps = stepsForModality(process.modality);
  const currentStep = resolveCurrentStep(steps, process.stepKey, process.stage);
  const viewedStep = steps.find((step) => step.key === etapa) ?? currentStep;
  const currentStage =
    flow.stages.find((stage) => stage.key === viewedStep.phase) ?? flow.stages[0];

  const participantIds = [...new Set(process.participants.map((p) => p.personId))];
  const [documents, pendencies, links, templates, riskAssessments, visitedSteps, people] = await Promise.all([
    listProcessDocuments(ctx, id),
    listProcessPendencies(ctx, id),
    listAccessLinks(ctx, id),
    listFormTemplates(ctx),
    listRiskAssessmentsForPeople(ctx, participantIds),
    listVisitedSteps(ctx, id),
    listPeople(ctx, { limit: 200 }),
  ]);

  const currentIndex = steps.findIndex((step) => step.key === currentStep.key);
  const stateOf = (step: ProcessStepDef): StepState =>
    step.key === currentStep.key
      ? "atual"
      : (step.conditional ? visitedSteps.includes(step.key) : steps.indexOf(step) < currentIndex)
        ? "concluida"
        : "pendente";
  // Desvio que nunca aconteceu só aparece quando é o atual: listar PEPT num
  // processo que passou de primeira na vistoria seria ruído.
  const visibleSteps = steps.filter(
    (step) => !step.conditional || stateOf(step) !== "pendente" || step.key === viewedStep.key,
  );
  const mainSteps = steps.filter((step) => !step.conditional);
  const trackName = STEP_TRACKS[trackForModality(process.modality)].name;

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
    `/processos/${id}?aba=${target}&etapa=${viewedStep.key}` as Route;

  return (
    <>
      <PageHeader
        title={`Processo #${process.number}`}
        description={proponent ? `${proponent.fullName} · ${formatCpf(proponent.cpf)}` : undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ProcessHeaderControls
              processId={id}
              steps={steps.map((step) => ({ value: step.key, label: step.label }))}
              stepKey={currentStep.key}
              status={process.status}
            />
            <ProcessDocuments
              processId={id}
              templates={templates
                .filter((template) => Object.keys(template.fieldMap).length > 0)
                .map((template) => ({ id: template.id, name: template.name }))}
            />
          </div>
        }
      />

      <main className="flex flex-col gap-5 p-6 lg:flex-row">
        <nav className="lg:w-64 lg:shrink-0" aria-label="Etapas do processo">
          <p className="mb-2 hidden px-3 text-xs font-medium uppercase tracking-wide text-ink-muted lg:block">
            {trackName}
          </p>
          <ol className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {visibleSteps.map((step) => {
              const state = stateOf(step);
              const active = step.key === viewedStep.key;
              const number = mainSteps.findIndex((s) => s.key === step.key) + 1;
              return (
                <li key={step.key} className="shrink-0 lg:shrink">
                  <Link
                    href={`/processos/${id}?aba=etapas&etapa=${step.key}` as Route}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition",
                      active
                        ? "bg-brand-50 font-medium text-brand-700"
                        : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                      state === "atual" && !active ? "font-medium text-ink" : null,
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                        state === "concluida"
                          ? "bg-status-aprovado text-white"
                          : state === "atual"
                            ? "bg-status-aguardando text-white"
                            : "bg-surface-muted text-ink-muted",
                      )}
                    >
                      {state === "concluida" ? <Check className="size-3" /> : step.conditional ? "↺" : number}
                    </span>
                    {step.label}
                    {state === "atual" ? <span className="sr-only"> (etapa atual)</span> : null}
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

          {tab === "etapas" ? (
            <RiskCard
              processId={id}
              linkedId={process.riskAssessmentId}
              assessments={riskAssessments}
              showPerson={participantIds.length > 1}
            />
          ) : null}

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
              key={viewedStep.key}
              processId={id}
              stepKey={viewedStep.key}
              fieldsKey={currentStage.key}
              stepLabel={viewedStep.label}
              subtitle={[
                viewedStep.conditional
                  ? "Desvio"
                  : `Etapa ${mainSteps.findIndex((s) => s.key === viewedStep.key) + 1} de ${mainSteps.length}`,
                viewedStep.responsible,
                viewedStep.system,
                viewedStep.hint,
              ]
                .filter(Boolean)
                .join(" · ")}
              blocks={blocks}
              options={options}
              state={stateOf(viewedStep)}
              assignedTo={stateByStep.get(viewedStep.key)?.assignedTo ?? null}
              members={memberOptions}
              actions={
                <StepActions
                  processId={id}
                  step={viewedStep}
                  isCurrent={viewedStep.key === currentStep.key}
                  next={nextStep(steps, currentStep)}
                  detours={detoursFrom(steps, currentStep)}
                />
              }
            />
          ) : null}

          {tab === "etapas" ? (
            <ParticipantsCard
              processId={id}
              participants={process.participants}
              people={people.rows.map((person) => ({
                value: person.id,
                label: `${person.fullName} — ${formatCpf(person.cpf)}`,
              }))}
            />
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
