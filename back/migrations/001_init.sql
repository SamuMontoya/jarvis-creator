-- Esquema completo de JARVIS Creator.
-- Idempotente: se puede correr sobre una base vacía o existente.

-- ─────────────────────────────────────────────
-- Trigger compartido para mantener updated_at
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- Preguntas genéricas (catálogo fijo)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generic_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pregunta TEXT NOT NULL UNIQUE,
  orden INTEGER NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generic_questions_orden ON generic_questions(orden);

-- ─────────────────────────────────────────────
-- Ideas
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  texto_idea TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'draft' CHECK (estado IN ('draft', 'refined')),
  md_final TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ideas_updated_at ON ideas(updated_at DESC);

DROP TRIGGER IF EXISTS trg_ideas_updated_at ON ideas;
CREATE TRIGGER trg_ideas_updated_at
  BEFORE UPDATE ON ideas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- Respuestas a preguntas genéricas
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS respuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  generic_question_id UUID NOT NULL REFERENCES generic_questions(id) ON DELETE CASCADE,
  respuesta TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idea_id, generic_question_id)
);

CREATE INDEX IF NOT EXISTS idx_respuestas_idea_id ON respuestas(idea_id);

DROP TRIGGER IF EXISTS trg_respuestas_updated_at ON respuestas;
CREATE TRIGGER trg_respuestas_updated_at
  BEFORE UPDATE ON respuestas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- Preguntas dinámicas (generadas por Groq por idea)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dynamic_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  pregunta TEXT NOT NULL,
  orden INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idea_id, orden)
);

CREATE INDEX IF NOT EXISTS idx_dynamic_questions_idea_id ON dynamic_questions(idea_id);

-- ─────────────────────────────────────────────
-- Respuestas a preguntas dinámicas
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dynamic_respuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  dynamic_question_id UUID NOT NULL REFERENCES dynamic_questions(id) ON DELETE CASCADE,
  respuesta TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idea_id, dynamic_question_id)
);

CREATE INDEX IF NOT EXISTS idx_dynamic_respuestas_idea_id ON dynamic_respuestas(idea_id);

DROP TRIGGER IF EXISTS trg_dynamic_respuestas_updated_at ON dynamic_respuestas;
CREATE TRIGGER trg_dynamic_respuestas_updated_at
  BEFORE UPDATE ON dynamic_respuestas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- RLS
-- El backend habla con Supabase usando la service_role key, que ignora RLS.
-- Las políticas abiertas existen para que la anon key siga sirviendo en
-- desarrollo. Restringir al agregar autenticación de usuarios.
-- ─────────────────────────────────────────────
ALTER TABLE generic_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE respuestas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_respuestas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON generic_questions;
DROP POLICY IF EXISTS "Allow all for anon" ON ideas;
DROP POLICY IF EXISTS "Allow all for anon" ON respuestas;
DROP POLICY IF EXISTS "Allow all for anon" ON dynamic_questions;
DROP POLICY IF EXISTS "Allow all for anon" ON dynamic_respuestas;

CREATE POLICY "Allow all for anon" ON generic_questions  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON ideas              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON respuestas         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON dynamic_questions  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON dynamic_respuestas FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────
-- Semilla: las 5 preguntas del descubrimiento inicial
-- ─────────────────────────────────────────────
INSERT INTO generic_questions (pregunta, orden, activa) VALUES
  ('¿Cuál es el problema principal que resuelve tu idea?', 1, true),
  ('¿Quién es tu cliente ideal?',                          2, true),
  ('¿Cuál es tu propuesta de valor única?',                3, true),
  ('¿Cuál es tu modelo de negocio?',                       4, true),
  ('¿Cuáles son tus principales competidores?',            5, true)
ON CONFLICT (pregunta) DO UPDATE
  SET orden = EXCLUDED.orden,
      activa = EXCLUDED.activa;
