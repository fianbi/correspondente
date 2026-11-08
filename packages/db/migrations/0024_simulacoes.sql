CREATE TABLE "simulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"client_name" text NOT NULL,
	"client_phone" text,
	"oldest_birth_date" date,
	"family_income_cents" bigint,
	"fgts_three_years" boolean,
	"multiple_buyers" boolean,
	"property_value_cents" bigint,
	"had_subsidy" boolean,
	"owns_property" boolean,
	"scenarios" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"process_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_process_id_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "simulations_org_updated_idx" ON "simulations" USING btree ("org_id","updated_at");--> statement-breakpoint
CREATE INDEX "simulations_process_idx" ON "simulations" USING btree ("process_id");