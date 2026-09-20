CREATE TYPE "public"."process_event_kind" AS ENUM('campo_alterado', 'fase_alterada', 'status_alterado', 'etapa_iniciada', 'etapa_finalizada', 'responsavel_alterado', 'processo_criado');--> statement-breakpoint
CREATE TYPE "public"."stage_state" AS ENUM('pendente', 'em_andamento', 'concluida');--> statement-breakpoint
CREATE TABLE "flow_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"flow_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flow_stages_flow_key_unique" UNIQUE("flow_id","key")
);
--> statement-breakpoint
CREATE TABLE "flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flows_org_key_unique" UNIQUE("org_id","key")
);
--> statement-breakpoint
CREATE TABLE "process_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"actor_id" uuid,
	"kind" "process_event_kind" NOT NULL,
	"field_key" text,
	"old_value" text,
	"new_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_field_values" (
	"org_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"field_key" text NOT NULL,
	"value" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "process_field_values_process_id_field_key_pk" PRIMARY KEY("process_id","field_key")
);
--> statement-breakpoint
CREATE TABLE "process_stage_states" (
	"org_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"stage_key" text NOT NULL,
	"state" "stage_state" DEFAULT 'pendente' NOT NULL,
	"assigned_to" uuid,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "process_stage_states_process_id_stage_key_pk" PRIMARY KEY("process_id","stage_key")
);
--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "flow_id" uuid;--> statement-breakpoint
ALTER TABLE "flow_stages" ADD CONSTRAINT "flow_stages_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_stages" ADD CONSTRAINT "flow_stages_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_events" ADD CONSTRAINT "process_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_events" ADD CONSTRAINT "process_events_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_events" ADD CONSTRAINT "process_events_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_field_values" ADD CONSTRAINT "process_field_values_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_field_values" ADD CONSTRAINT "process_field_values_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_field_values" ADD CONSTRAINT "process_field_values_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_stage_states" ADD CONSTRAINT "process_stage_states_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_stage_states" ADD CONSTRAINT "process_stage_states_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_stage_states" ADD CONSTRAINT "process_stage_states_assigned_to_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flow_stages_flow_position_idx" ON "flow_stages" USING btree ("flow_id","position");--> statement-breakpoint
CREATE INDEX "process_events_process_idx" ON "process_events" USING btree ("org_id","process_id","created_at");--> statement-breakpoint
CREATE INDEX "process_field_values_org_idx" ON "process_field_values" USING btree ("org_id","process_id");