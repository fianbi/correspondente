-- A extensão até a 0.8.0 gravava como renda uma entrada da lista do portal
-- sem fonte, início nem valor (linha que o SICAQ monta vazia no meio de uma
-- alteração). Ela aparecia como renda em branco no cadastro e não
-- identifica nada, então sai. Renda lançada pela web sempre tem ao menos um
-- desses campos, e não é afetada.
DELETE FROM "person_incomes"
WHERE "source_document" IS NULL
  AND "source_name" IS NULL
  AND "occupation" IS NULL
  AND "start_date" IS NULL
  AND "gross_cents" IS NULL
  AND "net_cents" IS NULL
  -- O "Valor do Imposto de Renda" vem 0,00 na linha vazia.
  AND COALESCE("income_tax_cents", 0) = 0
  AND "proof_type" IS NULL
  AND "notes" IS NULL;
