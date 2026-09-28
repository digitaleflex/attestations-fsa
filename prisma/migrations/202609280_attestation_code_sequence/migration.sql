-- Migration: attestation_code_sequence (#316)
-- Remplace count()+1 (non atomique, P2002 en concurrence) par une séquence PG.
-- La séquence ne reset PAS mensuellement : le mois est déjà dans le code
-- (FSA-YYYY-MM-NNNNN-XXXXX), et la séquence assure seulement l'unicité du NNNNN.

CREATE SEQUENCE IF NOT EXISTS attestation_code_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- Rattrapage : positionner la séquence au-delà du max actuel pour éviter
-- tout conflit avec les codes déjà émis.
DO $$
DECLARE
  max_seq bigint;
BEGIN
  SELECT COALESCE(MAX(
    CAST(
      SPLIT_PART(SPLIT_PART(code, '-', 4), '-', 1) AS bigint
    )
  ), 0)
  INTO max_seq
  FROM "Attestation"
  WHERE code LIKE 'FSA-%';

  IF max_seq > 0 THEN
    PERFORM setval('attestation_code_seq', max_seq);
  END IF;
END $$;