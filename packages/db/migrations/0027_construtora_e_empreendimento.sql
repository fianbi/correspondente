-- Construtora e empreendimento passam a fazer parte do bloco "Imóvel" da fase
-- de cadastro. Como em 0026, os campos são acrescentados às cópias do fluxo
-- que cada escritório já tem, sem mexer no resto da configuração.
UPDATE "flow_stages"
SET "blocks" = (
  SELECT jsonb_agg(
    CASE
      WHEN b->>'key' = 'imovel' AND NOT (b->'fields' ? 'process.builder')
        THEN jsonb_set(
          b,
          '{fields}',
          (b->'fields') || '["process.builder","process.development"]'::jsonb
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
