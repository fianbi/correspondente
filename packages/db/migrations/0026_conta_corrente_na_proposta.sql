-- Conta corrente (agência, operação, número, DV) passa a fazer parte dos
-- "Dados da proposta". O fluxo de cada escritório é uma cópia do padrão, então
-- os campos novos são acrescentados ao bloco `proposta` das cópias existentes,
-- sem mexer no resto do que o escritório configurou.
UPDATE "flow_stages"
SET "blocks" = (
  SELECT jsonb_agg(
    CASE
      WHEN b->>'key' = 'proposta' AND NOT (b->'fields' ? 'process.checking_account_number')
        THEN jsonb_set(
          b,
          '{fields}',
          (b->'fields') || '["process.checking_agency","process.checking_operation","process.checking_account_number","process.checking_dv"]'::jsonb
        )
      ELSE b
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements("blocks") WITH ORDINALITY AS t(b, ord)
)
WHERE "key" = 'cadastro'
  AND jsonb_typeof("blocks") = 'array'
  AND jsonb_array_length("blocks") > 0;
