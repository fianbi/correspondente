ALTER TABLE "risk_assessments" ADD COLUMN "housing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Classifica as avaliações já gravadas com o mesmo padrão de
-- `isHousingRiskAssessment` (`@corr/core/domain/risk.ts`).
UPDATE "risk_assessments"
SET "housing" = true
WHERE lower(translate(
  coalesce("product", '') || ' ' || coalesce("request_type", ''),
  'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
  'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
)) ~ '(habita|imobili|imovel|sfh|sbpe|mcmv|minha casa|casa verde|moradia|financiamento de casa)';
--> statement-breakpoint
-- O processo só fica com avaliação de habitação: a de CROT ou cartão que tinha
-- entrado sozinha é desfeita, e a próxima captura vincula a certa.
UPDATE "processes" p
SET "risk_assessment_id" = NULL
FROM "risk_assessments" r
WHERE r."id" = p."risk_assessment_id" AND r."housing" = false;
