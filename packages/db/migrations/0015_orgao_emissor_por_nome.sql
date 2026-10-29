-- A captura automática anterior à extensão 0.3.0 gravava o código do órgão
-- emissor da lista do portal ("83") em vez do nome que o cadastro guarda
-- ("ÓRGÃO DE TRÂNSITO"), e não gravava o tipo de documento. Como a captura só
-- preenche campo vazio, esses cadastros não se corrigiriam sozinhos.
--
-- O código também diz o tipo: 83 só existe para CNH, 44 e 82 para passaporte,
-- 40 e 95 para RIC; os demais são da carteira de identidade.

UPDATE "people"
SET "doc_type" = CASE "doc_issuer"
    WHEN '83' THEN 'cnh'
    WHEN '44' THEN 'passaporte'
    WHEN '82' THEN 'passaporte'
    WHEN '40' THEN 'ric'
    WHEN '95' THEN 'ric'
    ELSE 'rg'
  END::"id_document_type"
WHERE "doc_type" IS NULL
  AND "doc_issuer" IN ('10', '40', '44', '81', '82', '83', '88', '90', '91', '95');
--> statement-breakpoint
UPDATE "people"
SET "doc_issuer" = CASE "doc_issuer"
    WHEN '10' THEN 'SECRETARIA DE SEGURANÇA PÚBLICA'
    WHEN '40' THEN 'MINISTÉRIO DA JUSTIÇA'
    WHEN '44' THEN 'POLÍCIA FEDERAL'
    WHEN '81' THEN 'OUTRO TIPO DE ÓRGÃO EMISSOR'
    WHEN '82' THEN 'ÓRGÃO EMISSOR ESTRANGEIRO'
    WHEN '83' THEN 'ÓRGÃO DE TRÂNSITO'
    WHEN '88' THEN 'SECRETARIA DEFESA SOCIAL'
    WHEN '90' THEN 'POLÍCIA CIVIL'
    WHEN '91' THEN 'SECRETARIA DE ESTADO DA CASA CIVIL'
    WHEN '95' THEN 'OUTRO TIPO DE ÓRGÃO EMISSOR DE RIC'
  END
WHERE "doc_issuer" IN ('10', '40', '44', '81', '82', '83', '88', '90', '91', '95');
