-- Esquema relacional do PRISMA (Fase 2, seção 5.2). PostgreSQL 14+.
CREATE SCHEMA IF NOT EXISTS questoes;
SET search_path TO questoes;

CREATE TABLE IF NOT EXISTS origem (
  id_origem SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome      VARCHAR(60) NOT NULL UNIQUE,
  descricao VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS disciplina (
  id_disciplina SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome          VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tema (
  id_tema       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_disciplina SMALLINT NOT NULL REFERENCES disciplina(id_disciplina),
  nome          VARCHAR(120) NOT NULL,
  UNIQUE (id_disciplina, nome)
);

CREATE TABLE IF NOT EXISTS dificuldade (
  id_dificuldade SMALLINT PRIMARY KEY,
  descricao      VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS questao (
  id_questao     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enunciado      TEXT NOT NULL CHECK (length(btrim(enunciado)) > 0),
  id_origem      SMALLINT NOT NULL REFERENCES origem(id_origem),
  id_externo     VARCHAR(100),
  validado       BOOLEAN NOT NULL DEFAULT false,
  dt_criacao     TIMESTAMPTZ NOT NULL DEFAULT now(),
  dt_atualizacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id_origem, id_externo)
);

CREATE TABLE IF NOT EXISTS metadados (
  id_questao     BIGINT PRIMARY KEY REFERENCES questao(id_questao) ON DELETE CASCADE,
  id_tema        INTEGER NOT NULL REFERENCES tema(id_tema),
  id_dificuldade SMALLINT NOT NULL REFERENCES dificuldade(id_dificuldade)
);

CREATE TABLE IF NOT EXISTS alternativa (
  id_alternativa BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_questao     BIGINT NOT NULL REFERENCES questao(id_questao) ON DELETE CASCADE,
  letra          CHAR(1) NOT NULL CHECK (letra BETWEEN 'A' AND 'J'),
  texto          TEXT NOT NULL CHECK (length(btrim(texto)) > 0),
  correta        BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (id_questao, letra)
);

CREATE TABLE IF NOT EXISTS gabarito (
  id_gabarito BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  data_hora   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gabarito_questao (
  id_gabarito BIGINT NOT NULL REFERENCES gabarito(id_gabarito) ON DELETE CASCADE,
  id_questao  BIGINT NOT NULL REFERENCES questao(id_questao),
  ordem       SMALLINT NOT NULL CHECK (ordem > 0),
  PRIMARY KEY (id_gabarito, id_questao),
  UNIQUE (id_gabarito, ordem)
);

-- Índices (seção 5.3)
CREATE UNIQUE INDEX IF NOT EXISTS ux_alt_correta ON alternativa (id_questao) WHERE correta;
CREATE INDEX IF NOT EXISTS idx_metadados_tema ON metadados (id_tema);
CREATE INDEX IF NOT EXISTS idx_metadados_dificuldade ON metadados (id_dificuldade);
CREATE INDEX IF NOT EXISTS idx_questao_validado ON questao (validado);
CREATE INDEX IF NOT EXISTS idx_gabarito_questao_questao ON gabarito_questao (id_questao);

-- Invalida a questão quando ela, suas alternativas ou metadados mudam
CREATE OR REPLACE FUNCTION fn_invalidar_questao() RETURNS trigger AS $$
DECLARE qid BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'questao' THEN
    IF NEW.validado AND OLD.validado AND (NEW.enunciado IS DISTINCT FROM OLD.enunciado) THEN
      NEW.validado := false;
    END IF;
    NEW.dt_atualizacao := now();
    RETURN NEW;
  END IF;
  qid := COALESCE(NEW.id_questao, OLD.id_questao);
  UPDATE questao SET validado = false, dt_atualizacao = now() WHERE id_questao = qid AND validado;
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_questao_invalida ON questao;
CREATE TRIGGER trg_questao_invalida BEFORE UPDATE ON questao
  FOR EACH ROW EXECUTE FUNCTION fn_invalidar_questao();
DROP TRIGGER IF EXISTS trg_alternativa_invalida ON alternativa;
CREATE TRIGGER trg_alternativa_invalida AFTER INSERT OR UPDATE OR DELETE ON alternativa
  FOR EACH ROW EXECUTE FUNCTION fn_invalidar_questao();
DROP TRIGGER IF EXISTS trg_metadados_invalida ON metadados;
CREATE TRIGGER trg_metadados_invalida AFTER INSERT OR UPDATE OR DELETE ON metadados
  FOR EACH ROW EXECUTE FUNCTION fn_invalidar_questao();

-- Só questões validadas entram em gabarito
CREATE OR REPLACE FUNCTION fn_gabarito_questao_validada() RETURNS trigger AS $$
BEGIN
  IF NOT (SELECT validado FROM questao WHERE id_questao = NEW.id_questao) THEN
    RAISE EXCEPTION 'Questão % não está validada', NEW.id_questao;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gabarito_questao_validada ON gabarito_questao;
CREATE TRIGGER trg_gabarito_questao_validada BEFORE INSERT ON gabarito_questao
  FOR EACH ROW EXECUTE FUNCTION fn_gabarito_questao_validada();
