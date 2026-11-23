SET search_path TO questoes;
ALTER TABLE gabarito_questao ADD COLUMN IF NOT EXISTS letra_correta CHAR(1);
ALTER TABLE gabarito_questao ADD COLUMN IF NOT EXISTS snapshot_legado BOOLEAN NOT NULL DEFAULT false;
-- O passado não pode ser reconstruído: preserva o estado disponível e sinaliza legado.
UPDATE gabarito_questao gq SET letra_correta = COALESCE(
  (SELECT letra FROM alternativa a WHERE a.id_questao=gq.id_questao AND a.correta), '?'),
  snapshot_legado = true WHERE letra_correta IS NULL;
ALTER TABLE gabarito_questao ALTER COLUMN letra_correta SET NOT NULL;
