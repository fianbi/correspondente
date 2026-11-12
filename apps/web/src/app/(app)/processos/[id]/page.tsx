import { perguntasDoModelo } from "@/lib/formularios";
import { origemPronta, perguntasDoModeloPronto } from "@/server/pdf/modelos";
import Link from "next/link";
import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import {
  DOCUMENT_TYPE_LABELS,
  MODALITY_LABELS,
  formatBRL,
  NotFoundError,
  PARTICIPANT_ROLE_LABELS,
  type DocumentType,
  detoursFrom,
  formatCpf,
  nextStep,
  pode,
  requireField,
  resolveCurrentStep,
  stepsForModality,
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
  getProcessSimulation,
  listPeople,
  listVisitedSteps,
} from "@corr/db";
import { requireOrgContext } from "@/server/session";
import { enderecoDoSistema } from "@/server/url";
import { PageHeader } from "@/components/shell/page-header";
import { cn } from "@/lib/utils";
import type { DynamicOptions } from "@/components/fields/field-input";
import { History } from "./history";
import { rotuloAgencia } from "@/lib/agencias";
import { StageForm, type RenderBlock, type StepState } from "./stage-form";
import { StepHeader } from "./step-header";
import { StepActions } from "./step-progress";
import { ProcessHeaderControls } from "./header-controls";
import { ProcessDocuments } from "./process-documents";
import { participantesDaDamp } from "@/server/damp/participantes";
import { DocumentsPanel } from "./documents-panel";
import { PendenciesPanel } from "./pendencies-panel";
import { RiskCard } from "./risk-card";
import { ParticipantsCard } from "./participants-card";
import { DeleteProcess } from "./delete-process";
import { CobrarCliente } from "./cobrar-cliente";

export const metadata: Metadata = { title: "Processo" };

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
    agencies: agencies.map((a) => ({ value: a.id, label: rotuloAgencia(a) })),
    brokers: brokers.map((b) => ({ value: b.id, label: b.name })),
    real_estate_agencies: realEstate.map((a) => ({
      value: a.id,
      label: a.name,
    })),
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
  const [
    documents,
    pendencies,
    links,
    templates,
    riskAssessments,
    visitedSteps,
    people,
    simulation,
  ] = await Promise.all([
    listProcessDocuments(ctx, id, participantIds),
    listProcessPendencies(ctx, id),
    listAccessLinks(ctx, id),
    listFormTemplates(ctx),
    listRiskAssessmentsForPeople(ctx, participantIds),
    listVisitedSteps(ctx, id),
    listPeople(ctx, { limit: 200 }),
    getProcessSimulation(ctx, id),
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

  const checklist = await buildChecklist(ctx, id, viewedStep.requirements ?? [], participantIds);

  // Uma linha por pessoa, com todos os papéis dela no processo: o mesmo
  // cônjuge pode ser proponente e fiador, mas os documentos são um só.
  const processPeople = participantIds.map((personId) => {
    const entries = process.participants.filter((p) => p.personId === personId);
    return {
      personId,
      fullName: entries[0]!.fullName,
      phone: entries[0]!.phone,
      roles: entries.map((p) => PARTICIPANT_ROLE_LABELS[p.role]),
    };
  });

  const openPendencies = pendencies.filter((p) => p.status === "aberta");

  const linkRows = links.map((link) => ({
    id: link.id,
    label: link.label,
    canUpload: link.canUpload,
    expired: link.expired,
    revoked: link.revoked,
    accessCount: link.accessCount,
  }));

  const portalBaseUrl = await enderecoDoSistema();

  const proponent = process.participants.find((p) => p.role === "proponente");

  // Cada etapa mostra só os campos dela. Etapa sem campos (projeto na
  // prefeitura, ITBI) mostra só o roteiro e os documentos.
  const blocks: RenderBlock[] = (viewedStep.blocks ?? []).map((block) => ({
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

  const stepHref = (key: string) => `/processos/${id}?etapa=${key}` as Route;
  const viewedState = stateOf(viewedStep);
  const viewedNumber = mainSteps.findIndex((s) => s.key === viewedStep.key) + 1;
  const isCurrent = viewedStep.key === currentStep.key;
  const next = nextStep(steps, currentStep);
  const missingDocs = checklist.filter((item) => !item.satisfied);

  // Pessoas e avaliação de risco aparecem abertas só onde são o assunto.
  const peopleInStep = viewedStep.key === "documentacao_pessoal";
  const riskInStep = viewedStep.key === "analise_risco" || viewedStep.key === "evolucao_score";
  const openSection =
    aba === "documentos" || aba === "historico" || aba === "pendencias" ? aba : null;

  const resumo = [
    {
      label: "Modalidade",
      value: process.modality ? MODALITY_LABELS[process.modality] : null,
    },
    {
      label: "Valor do imóvel",
      value: process.propertyValueCents ? formatBRL(process.propertyValueCents) : null,
    },
    {
      label: "Financiado",
      value: process.financedValueCents ? formatBRL(process.financedValueCents) : null,
    },
    {
      label: "Agência",
      value: process.agencyId ? relations[process.agencyId] : null,
    },
    {
      label: "Responsável",
      value: process.assignedTo ? relations[process.assignedTo] : null,
    },
  ];

  const participantsCard = (
    <ParticipantsCard
      processId={id}
      participants={process.participants}
      people={people.rows.map((person) => ({
        value: person.id,
        label: `${person.fullName} — ${formatCpf(person.cpf)}`,
      }))}
    />
  );
  const riskCard = (
    <RiskCard
      processId={id}
      linkedId={process.riskAssessmentId}
      assessments={riskAssessments}
      showPerson={participantIds.length > 1}
    />
  );
  const pendenciesPanel = (
    <PendenciesPanel processId={id} stageKey={currentStage?.key ?? null} pendencies={pendencies} />
  );

  return (
    <>
      <PageHeader
        title={`Processo #${process.number}`}
        description={proponent ? `${proponent.fullName} · ${formatCpf(proponent.cpf)}` : undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ProcessHeaderControls processId={id} status={process.status} />
            <ProcessDocuments
              processId={id}
              damp={participantesDaDamp(process).map(({ personId, fullName }) => ({
                personId,
                fullName,
              }))}
              templates={templates
                .filter((template) => Object.keys(template.fieldMap).length > 0)
                .map((template) => ({
                  id: template.id,
                  name: template.name,
                  perguntas: (() => {
                    const pronto = origemPronta(template);
                    return pronto
                      ? perguntasDoModeloPronto(pronto)
                      : perguntasDoModelo(template.fieldMap);
                  })(),
                }))}
            />
            {pode(ctx.role, "excluir_processo") ? (
              <DeleteProcess processId={id} number={process.number} />
            ) : null}
          </div>
        }
      />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {resumo.map((item) => (
            <div key={item.label} className="flex gap-1.5">
              <dt className="text-ink-muted">{item.label}:</dt>
              <dd className="font-medium text-ink">{item.value ?? "—"}</dd>
            </div>
          ))}
          {simulation ? (
            <div className="flex gap-1.5">
              <dt className="text-ink-muted">Simulação:</dt>
              <dd>
                <Link
                  href={`/simulacoes/${simulation.id}` as Route}
                  className="font-medium text-brand-600 hover:underline"
                >
                  {simulation.clientName}
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>

        {/* Barra de etapas: uma bolinha por etapa, o nome aparece ao passar o mouse. */}
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <nav aria-label="Etapas do processo" data-etapa-atual={currentStep.key}>
            <ol className="flex items-center overflow-x-auto pb-1">
              {visibleSteps.map((step, index) => {
                const state = stateOf(step);
                const active = step.key === viewedStep.key;
                const number = mainSteps.findIndex((s) => s.key === step.key) + 1;
                return (
                  <li key={step.key} className="flex shrink-0 items-center">
                    {index > 0 ? (
                      <span
                        aria-hidden
                        className={cn(
                          "h-0.5 w-3 sm:w-5",
                          state === "pendente" ? "bg-line" : "bg-status-aprovado/60",
                        )}
                      />
                    ) : null}
                    <Link
                      href={stepHref(step.key)}
                      title={`${step.conditional ? "Desvio: " : `${number}. `}${step.label}`}
                      aria-label={step.label}
                      aria-current={active ? "step" : undefined}
                      className={cn(
                        "grid size-7 place-items-center rounded-full text-xs font-semibold transition",
                        state === "concluida"
                          ? "bg-status-aprovado text-white"
                          : state === "atual"
                            ? "bg-status-aguardando text-white"
                            : "bg-surface-muted text-ink-muted hover:bg-line",
                        active ? "ring-2 ring-brand-500 ring-offset-2" : null,
                      )}
                    >
                      {state === "concluida" ? (
                        <Check className="size-3.5" aria-hidden />
                      ) : step.conditional ? (
                        "↺"
                      ) : (
                        number
                      )}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>
          <p className="mt-2 text-xs text-ink-muted">
            Etapa atual:{" "}
            <Link href={stepHref(currentStep.key)} className="font-medium text-ink hover:underline">
              {currentStep.label}
            </Link>
            {next ? <> · Próxima: {next.label}</> : null}
          </p>
        </div>

        {/* A etapa aberta: só o que se faz nela. */}
        <section
          aria-label={`Etapa: ${viewedStep.label}`}
          className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-4 shadow-sm sm:p-5"
        >
          <StepHeader
            key={`cabecalho-${viewedStep.key}`}
            processId={id}
            stepKey={viewedStep.key}
            label={viewedStep.label}
            subtitle={[
              viewedStep.conditional ? "Desvio" : `Etapa ${viewedNumber} de ${mainSteps.length}`,
              viewedStep.responsible,
              viewedStep.system,
            ]
              .filter(Boolean)
              .join(" · ")}
            state={viewedState}
            assignedTo={stateByStep.get(viewedStep.key)?.assignedTo ?? null}
            members={memberOptions}
          />

          {viewedStep.todo || viewedStep.doneWhen ? (
            <div className="rounded-md bg-surface-muted px-4 py-3 text-sm">
              {viewedStep.todo ? (
                <ul className="list-disc space-y-0.5 pl-5 text-ink">
                  {viewedStep.todo.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {viewedStep.doneWhen ? (
                <p className="mt-2 text-ink-muted">
                  <span className="font-medium text-ink">Conclui quando:</span>{" "}
                  {viewedStep.doneWhen}
                </p>
              ) : null}
              {viewedStep.hint ? (
                <p className="mt-1 text-xs text-ink-muted">{viewedStep.hint}</p>
              ) : null}
            </div>
          ) : null}

          {peopleInStep ? participantsCard : null}
          {riskInStep ? riskCard : null}

          {currentStage && blocks.length > 0 ? (
            <StageForm
              key={viewedStep.key}
              processId={id}
              stepKey={viewedStep.key}
              fieldsKey={currentStage.key}
              blocks={blocks}
              options={options}
              agencias={agencies.map((a) => ({
                id: a.id,
                number: a.number,
                name: a.name,
                city: a.city,
              }))}
            />
          ) : null}

          {checklist.length > 0 ? (
            <DocumentsPanel
              processId={id}
              stageKey={currentStage?.key ?? null}
              stepLabel={viewedStep.label}
              documents={documents}
              checklist={checklist}
              people={processPeople}
              links={linkRows}
              portalBaseUrl={portalBaseUrl}
              canDelete={pode(ctx.role, "excluir_documento")}
              parts={{ checklist: true, uploader: missingDocs.length > 0 }}
            />
          ) : null}

          {isCurrent && (missingDocs.some((item) => item.required) || openPendencies.length > 0) ? (
            <CobrarCliente
              escritorio={ctx.orgName}
              processNumber={process.number}
              etapa={viewedStep.label}
              destinatarios={processPeople}
              documentosFaltando={missingDocs.map((item) => ({
                label: DOCUMENT_TYPE_LABELS[item.documentType as DocumentType] ?? item.documentType,
                required: item.required,
              }))}
              pendencias={openPendencies.map((p) => p.title)}
            />
          ) : null}

          {openPendencies.length > 0 ? pendenciesPanel : null}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
            {isCurrent && next ? (
              <p className="mr-auto text-xs text-ink-muted">
                {viewedStep.conditional ? "Ao concluir, volta para" : "Ao concluir, vai para"}:{" "}
                {next.label}
              </p>
            ) : !isCurrent ? (
              <p className="mr-auto text-xs text-ink-muted">
                O processo está em {currentStep.label}.
              </p>
            ) : null}
            <StepActions
              processId={id}
              step={viewedStep}
              isCurrent={isCurrent}
              next={next}
              detours={detoursFrom(steps, currentStep)}
            />
          </div>
        </section>

        {/* O resto do processo, recolhido: abre no lugar, sem trocar de tela. */}
        <div className="flex flex-col gap-3">
          {peopleInStep ? null : (
            <Section title="Pessoas do processo" count={processPeople.length}>
              {participantsCard}
            </Section>
          )}
          {riskInStep ? null : <Section title="Avaliação de risco">{riskCard}</Section>}
          <Section
            title="Todos os documentos"
            count={documents.length}
            open={openSection === "documentos"}
          >
            <DocumentsPanel
              processId={id}
              stageKey={currentStage?.key ?? null}
              stepLabel={viewedStep.label}
              documents={documents}
              checklist={[]}
              people={processPeople}
              links={linkRows}
              portalBaseUrl={portalBaseUrl}
              canDelete={pode(ctx.role, "excluir_documento")}
              parts={{
                uploader: missingDocs.length === 0,
                list: true,
                links: true,
              }}
            />
          </Section>
          {openPendencies.length > 0 ? null : (
            <Section
              title="Pendências"
              count={pendencies.length}
              open={openSection === "pendencias"}
            >
              {pendenciesPanel}
            </Section>
          )}
          <Section title="Histórico" open={openSection === "historico"}>
            <HistoryTab processId={id} actors={members} relations={relations} />
          </Section>
        </div>
      </main>
    </>
  );
}

function Section({
  title,
  count,
  open,
  children,
}: {
  title: string;
  count?: number;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={open} className="group rounded-lg border border-line bg-surface shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-semibold text-ink hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-4 text-ink-muted transition group-open:rotate-90"
          aria-hidden
        />
        {title}
        {count ? (
          <span className="rounded-full bg-surface-muted px-1.5 text-xs font-normal text-ink-muted">
            {count}
          </span>
        ) : null}
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
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
