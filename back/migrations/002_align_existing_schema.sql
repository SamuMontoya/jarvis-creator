-- Alinea una base ya existente con el esquema que la aplicación espera.
--
-- Idempotente y no destructivo: conserva ideas, respuestas y el texto de las
-- preguntas genéricas que ya estén cargadas. Corre esto si la base se creó
-- antes de 001_init.sql. En una base vacía, usa 001_init.sql en su lugar.
--
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query

BEGIN;

-- ─────────────────────────────────────────────
-- 1. Trigger compartido para updated_at
--    Sin esto, PATCH /ideas no toca updated_at y GET /ideas ordenado por
--    updated_at DESC nunca refleja la actividad reciente.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- 2. generic_questions: columnas que faltaban
-- ─────────────────────────────────────────────
ALTER TABLE generic_questions
  ADD COLUMN IF NOT EXISTS activa BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_generic_questions_orden ON generic_questions(orden);

-- ─────────────────────────────────────────────
-- 3. respuestas: limpiar antes de poder imponer UNIQUE
-- ─────────────────────────────────────────────
ALTER TABLE respuestas
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Filas inservibles: sin pregunta asociada o sin texto.
DELETE FROM respuestas WHERE generic_question_id IS NULL OR respuesta IS NULL;

-- Duplicados previos por (idea_id, generic_question_id): conserva el más
-- reciente, que es el que el usuario vería como su respuesta actual.
-- created_at es nullable, y comparar tuplas con NULL devuelve NULL (no true),
-- así que dos duplicados sin fecha sobrevivirían y el UNIQUE fallaría después.
-- COALESCE + id (PK, nunca nulo) garantiza un orden total.
DELETE FROM respuestas r
USING respuestas mas_nueva
WHERE r.idea_id = mas_nueva.idea_id
  AND r.generic_question_id = mas_nueva.generic_question_id
  AND (COALESCE(r.created_at, '-infinity'::timestamp), r.id)
    < (COALESCE(mas_nueva.created_at, '-infinity'::timestamp), mas_nueva.id);

ALTER TABLE respuestas
  ALTER COLUMN generic_question_id SET NOT NULL,
  ALTER COLUMN respuesta SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'respuestas_idea_question_key'
  ) THEN
    ALTER TABLE respuestas
      ADD CONSTRAINT respuestas_idea_question_key UNIQUE (idea_id, generic_question_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_respuestas_idea_id ON respuestas(idea_id);

-- ─────────────────────────────────────────────
-- 4. dynamic_questions: UNIQUE (idea_id, orden) para el upsert de generación
-- ─────────────────────────────────────────────
DELETE FROM dynamic_questions q
USING dynamic_questions mas_nueva
WHERE q.idea_id = mas_nueva.idea_id
  AND q.orden = mas_nueva.orden
  AND (COALESCE(q.created_at, '-infinity'::timestamp), q.id)
    < (COALESCE(mas_nueva.created_at, '-infinity'::timestamp), mas_nueva.id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dynamic_questions_idea_orden_key'
  ) THEN
    ALTER TABLE dynamic_questions
      ADD CONSTRAINT dynamic_questions_idea_orden_key UNIQUE (idea_id, orden);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dynamic_questions_idea_id ON dynamic_questions(idea_id);

-- ─────────────────────────────────────────────
-- 5. dynamic_respuestas: mismo UNIQUE para que editar sobrescriba
-- ─────────────────────────────────────────────
DELETE FROM dynamic_respuestas r
USING dynamic_respuestas mas_nueva
WHERE r.idea_id = mas_nueva.idea_id
  AND r.dynamic_question_id = mas_nueva.dynamic_question_id
  AND (COALESCE(r.created_at, '-infinity'::timestamp), r.id)
    < (COALESCE(mas_nueva.created_at, '-infinity'::timestamp), mas_nueva.id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dynamic_respuestas_idea_question_key'
  ) THEN
    ALTER TABLE dynamic_respuestas
      ADD CONSTRAINT dynamic_respuestas_idea_question_key UNIQUE (idea_id, dynamic_question_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dynamic_respuestas_idea_id ON dynamic_respuestas(idea_id);

-- ─────────────────────────────────────────────
-- 6. ideas: estado válido e índice de orden
-- ─────────────────────────────────────────────
UPDATE ideas SET estado = 'draft' WHERE estado IS NULL OR estado NOT IN ('draft', 'refined');

ALTER TABLE ideas ALTER COLUMN estado SET DEFAULT 'draft';
ALTER TABLE ideas ALTER COLUMN estado SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ideas_estado_check') THEN
    ALTER TABLE ideas
      ADD CONSTRAINT ideas_estado_check CHECK (estado IN ('draft', 'refined'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ideas_updated_at ON ideas(updated_at DESC);

-- ─────────────────────────────────────────────
-- 7. Triggers de updated_at
-- ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_ideas_updated_at ON ideas;
CREATE TRIGGER trg_ideas_updated_at
  BEFORE UPDATE ON ideas FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_respuestas_updated_at ON respuestas;
CREATE TRIGGER trg_respuestas_updated_at
  BEFORE UPDATE ON respuestas FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_dynamic_respuestas_updated_at ON dynamic_respuestas;
CREATE TRIGGER trg_dynamic_respuestas_updated_at
  BEFORE UPDATE ON dynamic_respuestas FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- 8. Borrado en cascada
--    DELETE /ideas/:id borra solo la idea y confía en que la base arrastre las
--    hijas. Se recrean las FK con ON DELETE CASCADE por si no lo tenían.
-- ─────────────────────────────────────────────
DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT c.conname, c.conrelid::regclass AS tabla,
           a.attname AS columna, c.confrelid::regclass AS referencia
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confdeltype <> 'c'
      AND c.conrelid::regclass::text
          IN ('respuestas', 'dynamic_questions', 'dynamic_respuestas')
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.tabla, fk.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(id) ON DELETE CASCADE',
      fk.tabla, fk.conname, fk.columna, fk.referencia
    );
    RAISE NOTICE 'FK % en % ahora es ON DELETE CASCADE', fk.conname, fk.tabla;
  END LOOP;
END $$;

COMMIT;

-- ─────────────────────────────────────────────
-- Verificación (debe devolver 5 filas, todas en true)
-- ─────────────────────────────────────────────
SELECT 'generic_questions.activa existe' AS control,
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'generic_questions' AND column_name = 'activa') AS ok
UNION ALL
SELECT 'UNIQUE en respuestas',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'respuestas_idea_question_key')
UNION ALL
SELECT 'UNIQUE en dynamic_respuestas',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dynamic_respuestas_idea_question_key')
UNION ALL
SELECT 'UNIQUE en dynamic_questions',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dynamic_questions_idea_orden_key')
UNION ALL
SELECT 'trigger updated_at en ideas',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ideas_updated_at');
