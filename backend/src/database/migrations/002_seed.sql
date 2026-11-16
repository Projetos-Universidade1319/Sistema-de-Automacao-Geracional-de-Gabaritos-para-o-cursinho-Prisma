SET search_path TO questoes;
INSERT INTO dificuldade (id_dificuldade, descricao) VALUES (1,'Fácil'),(2,'Médio'),(3,'Difícil')
  ON CONFLICT DO NOTHING;
INSERT INTO origem (nome, descricao) VALUES
  ('manual','Cadastro manual pela coordenação'),
  ('enem.dev','API pública api.enem.dev')
  ON CONFLICT DO NOTHING;
INSERT INTO disciplina (nome) VALUES
  ('Linguagens'),('Matemática'),('Ciências Humanas'),('Ciências da Natureza')
  ON CONFLICT DO NOTHING;
