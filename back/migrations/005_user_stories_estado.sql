-- Estado de avance de cada user story, editable vía PATCH /api/stories/:story_id.
-- Idempotente: se puede correr sobre una base vacía o existente.

ALTER TABLE user_stories
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'pendiente';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_stories_estado_check') THEN
    ALTER TABLE user_stories
      ADD CONSTRAINT user_stories_estado_check CHECK (estado IN ('pendiente', 'en_progreso', 'completada'));
  END IF;
END $$;
