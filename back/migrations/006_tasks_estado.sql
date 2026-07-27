-- Estado de avance de cada task, editable vía PATCH /api/tasks/:task_id.
-- Idempotente: se puede correr sobre una base vacía o existente.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'pendiente';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_estado_check') THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_estado_check CHECK (estado IN ('pendiente', 'en_progreso', 'completada'));
  END IF;
END $$;
