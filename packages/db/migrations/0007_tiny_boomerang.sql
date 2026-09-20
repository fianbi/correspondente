CREATE TYPE "public"."document_source" AS ENUM('interno', 'portal');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('recebido', 'aprovado', 'rejeitado');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('rg', 'cnh', 'certidao_nascimento', 'certidao_casamento', 'comprovante_residencia', 'comprovante_renda', 'extrato_fgts', 'declaracao_ir', 'carteira_trabalho', 'ficha_cadastral_banco', 'matricula_imovel', 'iptu', 'contrato_compra_venda', 'laudo_avaliacao', 'documento_vendedor', 'outro');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('nao_processado', 'pendente', 'concluido', 'falhou');--> statement-breakpoint
CREATE TYPE "public"."pendency_status" AS ENUM('aberta', 'resolvida');--> statement-breakpoint
CREATE TABLE "access_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"label" text NOT NULL,
	"can_upload" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_access_at" timestamp with time zone,
	"access_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"process_id" uuid,
	"person_id" uuid,
	"type" "document_type" DEFAULT 'outro' NOT NULL,
	"title" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"status" "document_status" DEFAULT 'recebido' NOT NULL,
	"source" "document_source" DEFAULT 'interno' NOT NULL,
	"stage_key" text,
	"uploaded_by" uuid,
	"uploaded_by_name" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"extracted_json" jsonb,
	"extraction" "extraction_status" DEFAULT 'nao_processado' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pendencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"stage_key" text,
	"title" text NOT NULL,
	"description" text,
	"status" "pendency_status" DEFAULT 'aberta' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"due_date" timestamp with time zone,
	"assigned_to" uuid,
	"created_by" uuid,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flow_stages" ADD COLUMN "requirements" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencies" ADD CONSTRAINT "pendencies_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencies" ADD CONSTRAINT "pendencies_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencies" ADD CONSTRAINT "pendencies_assigned_to_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencies" ADD CONSTRAINT "pendencies_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencies" ADD CONSTRAINT "pendencies_resolved_by_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_links_org_process_idx" ON "access_links" USING btree ("org_id","process_id");--> statement-breakpoint
CREATE INDEX "documents_org_process_idx" ON "documents" USING btree ("org_id","process_id");--> statement-breakpoint
CREATE INDEX "documents_org_person_idx" ON "documents" USING btree ("org_id","person_id");--> statement-breakpoint
CREATE INDEX "pendencies_org_status_idx" ON "pendencies" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "pendencies_org_process_idx" ON "pendencies" USING btree ("org_id","process_id");