CREATE TYPE "public"."education_level" AS ENUM('fundamental_ate_4a_incompleto', 'fundamental_4a_completo', 'fundamental_5a_8a_incompleto', 'fundamental_completo', 'medio_incompleto', 'medio_completo', 'superior_incompleto', 'superior_completo', 'pos_graduacao', 'mestrado', 'doutorado');--> statement-breakpoint
CREATE TYPE "public"."housing_situation" AS ENUM('propria_quitada', 'propria_financiada_caixa', 'propria_financiada_outras', 'alugada', 'mora_com_pais', 'cedida', 'funcional', 'outro');--> statement-breakpoint
CREATE TYPE "public"."id_document_type" AS ENUM('rg', 'cnh', 'passaporte', 'ric');--> statement-breakpoint
CREATE TYPE "public"."income_kind" AS ENUM('formal', 'informal');--> statement-breakpoint
CREATE TYPE "public"."income_proof_type" AS ENUM('contracheque', 'historico_contracheque', 'declaracao_ir', 'declaracao_empregador', 'decore', 'decore_com_darf', 'extrato_conta_salario', 'extrato_beneficio_previdenciario', 'extrato_fgts', 'extrato_aplicacao', 'contrato_aluguel', 'contrato_estagio', 'notas_fiscais_rural', 'rpa', 'recolhimento_iss', 'sentenca_judicial', 'recebimento_exterior');--> statement-breakpoint
CREATE TYPE "public"."marital_status" AS ENUM('solteiro', 'casado_comunhao_parcial', 'casado_comunhao_total', 'casado_separacao_bens', 'divorciado', 'separado_judicialmente', 'viuvo', 'uniao_estavel');--> statement-breakpoint
CREATE TYPE "public"."nationality" AS ENUM('brasileiro', 'brasileiro_naturalizado', 'brasileiro_nascido_exterior', 'estrangeiro');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('casa', 'apartamento', 'sitio', 'chacara', 'fazenda', 'outro');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('masculino', 'feminino');--> statement-breakpoint
CREATE TYPE "public"."amortization_system" AS ENUM('price', 'sac');--> statement-breakpoint
CREATE TYPE "public"."modality" AS ENUM('aquisicao_imovel_novo', 'aquisicao_imovel_usado', 'construcao', 'aquisicao_terreno_construcao', 'reforma_ampliacao', 'emprestimo_garantia_imovel', 'transferencia_financiamento');--> statement-breakpoint
CREATE TYPE "public"."participant_role" AS ENUM('proponente', 'coproponente', 'conjuge', 'vendedor', 'anuente');--> statement-breakpoint
CREATE TYPE "public"."process_stage" AS ENUM('cadastro', 'correspondente', 'montagem', 'conformidade_contrato', 'agencia', 'cri');--> statement-breakpoint
CREATE TYPE "public"."process_status" AS ENUM('em_aberto', 'aguardando', 'aprovado', 'condicionado', 'reprovado', 'assinado', 'vencido', 'pausado', 'cancelado', 'concluido');--> statement-breakpoint
CREATE TABLE "org_counters" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"next_process_number" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"cpf" text NOT NULL,
	"full_name" text NOT NULL,
	"short_name" text,
	"birth_date" date,
	"sex" "sex",
	"nationality" "nationality",
	"birth_uf" text,
	"birth_city" text,
	"mother_name" text,
	"father_name" text,
	"education_level" "education_level",
	"pis" text,
	"doc_type" "id_document_type",
	"doc_number" text,
	"doc_issuer" text,
	"doc_issuer_uf" text,
	"doc_issued_at" date,
	"doc_valid_until" date,
	"marital_status" "marital_status",
	"spouse_cpf" text,
	"spouse_name" text,
	"email" text,
	"phone" text,
	"zip_code" text,
	"street_type" text,
	"street" text,
	"street_number" text,
	"complement" text,
	"district" text,
	"city" text,
	"uf" text,
	"property_type" "property_type",
	"housing_situation" "housing_situation",
	"residence_proof_month" integer,
	"residence_proof_year" integer,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_org_cpf_unique" UNIQUE("org_id","cpf")
);
--> statement-breakpoint
CREATE TABLE "person_incomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" "income_kind" NOT NULL,
	"source_name" text,
	"source_document" text,
	"occupation" text,
	"start_date" date,
	"gross_cents" bigint,
	"net_cents" bigint,
	"income_tax_cents" bigint,
	"proof_type" "income_proof_type",
	"proof_month" integer,
	"proof_year" integer,
	"previous_job_years" integer,
	"previous_job_months" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"number" text NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"uf" text,
	"email" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agencies_org_bank_number_unique" UNIQUE("org_id","bank_id","number")
);
--> statement-breakpoint
CREATE TABLE "banks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "banks_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "brokers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"real_estate_agency_id" uuid,
	"name" text NOT NULL,
	"cpf" text,
	"creci" text,
	"email" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "real_estate_agencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cnpj" text,
	"creci" text,
	"email" text,
	"phone" text,
	"city" text,
	"uf" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_participants" (
	"org_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" "participant_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "process_participants_process_id_person_id_role_pk" PRIMARY KEY("process_id","person_id","role")
);
--> statement-breakpoint
CREATE TABLE "processes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"person_id" uuid NOT NULL,
	"stage" "process_stage" DEFAULT 'cadastro' NOT NULL,
	"status" "process_status" DEFAULT 'em_aberto' NOT NULL,
	"bank_id" uuid,
	"agency_id" uuid,
	"modality" "modality",
	"amortization_system" "amortization_system",
	"indexer" text,
	"contract_number" text,
	"proposal_number" text,
	"property_value_cents" bigint,
	"financed_value_cents" bigint,
	"approved_value_cents" bigint,
	"subsidy_cents" bigint,
	"fgts_cents" bigint,
	"term_months" integer,
	"credit_valid_until" date,
	"broker_id" uuid,
	"real_estate_agency_id" uuid,
	"assigned_to" uuid,
	"property_address" text,
	"property_registration" text,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processes_org_number_unique" UNIQUE("org_id","number")
);
--> statement-breakpoint
ALTER TABLE "org_counters" ADD CONSTRAINT "org_counters_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_incomes" ADD CONSTRAINT "person_incomes_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_incomes" ADD CONSTRAINT "person_incomes_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brokers" ADD CONSTRAINT "brokers_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brokers" ADD CONSTRAINT "brokers_real_estate_agency_id_real_estate_agencies_id_fk" FOREIGN KEY ("real_estate_agency_id") REFERENCES "public"."real_estate_agencies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "real_estate_agencies" ADD CONSTRAINT "real_estate_agencies_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_participants" ADD CONSTRAINT "process_participants_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_participants" ADD CONSTRAINT "process_participants_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_participants" ADD CONSTRAINT "process_participants_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_real_estate_agency_id_real_estate_agencies_id_fk" FOREIGN KEY ("real_estate_agency_id") REFERENCES "public"."real_estate_agencies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_assigned_to_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "people_org_name_idx" ON "people" USING btree ("org_id","full_name");--> statement-breakpoint
CREATE INDEX "person_incomes_person_idx" ON "person_incomes" USING btree ("org_id","person_id");--> statement-breakpoint
CREATE INDEX "brokers_org_name_idx" ON "brokers" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "real_estate_agencies_org_name_idx" ON "real_estate_agencies" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "process_participants_person_idx" ON "process_participants" USING btree ("org_id","person_id");--> statement-breakpoint
CREATE INDEX "processes_org_stage_idx" ON "processes" USING btree ("org_id","stage");--> statement-breakpoint
CREATE INDEX "processes_org_status_idx" ON "processes" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "processes_org_updated_idx" ON "processes" USING btree ("org_id","updated_at");--> statement-breakpoint
CREATE INDEX "processes_org_person_idx" ON "processes" USING btree ("org_id","person_id");