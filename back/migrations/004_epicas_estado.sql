-- Estado de avance de cada épica, editable vía PATCH /api/epicas/:epica_id.
-- Idempotente: se puede correr sobre una base vacía o existente.

ALTER TABLE epicas
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'pendiente';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'epicas_estado_check') THEN
    ALTER TABLE epicas
      ADD CONSTRAINT epicas_estado_check CHECK (estado IN ('pendiente', 'en_progreso', 'completada'));
  END IF;
END $$;
