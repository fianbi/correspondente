-- Captação, levantamento e definição da simulação viraram uma etapa só:
-- "Simulação" (chave `simulacao`). Processos parados nas etapas antigas vão
-- para ela. O histórico mantém as chaves antigas; a tela ainda sabe o nome.
UPDATE "processes"
SET "step_key" = 'simulacao'
WHERE "step_key" IN ('captacao', 'definicao_simulacao');
--> statement-breakpoint
UPDATE "process_stage_states"
SET "stage_key" = 'simulacao'
WHERE "stage_key" IN ('captacao', 'definicao_simulacao')
  AND NOT EXISTS (
    SELECT 1 FROM "process_stage_states" s2
    WHERE s2."process_id" = "process_stage_states"."process_id" AND s2."stage_key" = 'simulacao'
  );
