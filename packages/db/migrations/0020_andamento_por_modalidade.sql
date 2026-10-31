ALTER TYPE "public"."modality" ADD VALUE 'aquisicao_terreno' BEFORE 'construcao';--> statement-breakpoint
ALTER TYPE "public"."process_event_kind" ADD VALUE 'andamento_alterado';--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "step_key" text;