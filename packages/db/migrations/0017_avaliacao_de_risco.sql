ALTER TYPE "public"."process_event_kind" ADD VALUE 'avaliacao_risco_vinculada';--> statement-breakpoint
CREATE TABLE "risk_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"proposal_number" text NOT NULL,
	"sent_on" date,
	"product" text,
	"conformity" text,
	"result" text,
	"details" text,
	"valid_until" date,
	"request_type" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"captured_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "risk_assessments_person_proposal_unique" UNIQUE("org_id","person_id","proposal_number")
);
--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "risk_assessment_id" uuid;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_captured_by_profiles_id_fk" FOREIGN KEY ("captured_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "risk_assessments_org_person_idx" ON "risk_assessments" USING btree ("org_id","person_id");--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_risk_assessment_id_risk_assessments_id_fk" FOREIGN KEY ("risk_assessment_id") REFERENCES "public"."risk_assessments"("id") ON DELETE set null ON UPDATE no action;