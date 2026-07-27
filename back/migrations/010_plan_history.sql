-- Permite múltiples planes de trabajo por idea (historial de versiones) en
-- vez de uno solo: "Regenerar plan" ahora crea una versión nueva en lugar de
-- borrar la anterior. Ejecutar en: Supabase Dashboard > SQL Editor.

ALTER TABLE work_plans DROP CONSTRAINT IF EXISTS work_plans_idea_id_key;

-- El orden de versiones se resuelve por created_at; este índice ya cubre
-- las consultas "todas las versiones de una idea, más reciente primero".
CREATE INDEX IF NOT EXISTS idx_work_plans_idea_id_created_at
  ON work_plans(idea_id, created_at DESC);
