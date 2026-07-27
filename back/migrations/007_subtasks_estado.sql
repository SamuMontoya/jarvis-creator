-- Estado de avance de cada subtask, editable vía PATCH /api/subtasks/:subtask_id.
-- Idempotente: se puede correr sobre una base vacía o existente.

ALTER TABLE subtasks
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'pendiente';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subtasks_estado_check') THEN
    ALTER TABLE subtasks
      ADD CONSTRAINT subtasks_estado_check CHECK (estado IN ('pendiente', 'en_progreso', 'completada'));
  END IF;
END $$;
