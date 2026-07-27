-- Backlog generado por Groq a partir de una idea: plan de trabajo → épicas →
-- user stories → tasks → subtasks. Jerarquía lineal, sin dependencias paralelas.
-- Idempotente: se puede correr sobre una base vacía o existente.

CREATE TABLE IF NOT EXISTS work_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idea_id)
);

CREATE INDEX IF NOT EXISTS idx_work_plans_idea_id ON work_plans(idea_id);

CREATE TABLE IF NOT EXISTS epicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES work_plans(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  orden INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_epicas_plan_id ON epicas(plan_id);

CREATE TABLE IF NOT EXISTS user_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epica_id UUID NOT NULL REFERENCES epicas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  criterios_aceptacion TEXT,
  orden INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_stories_epica_id ON user_stories(epica_id);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_story_id UUID NOT NULL REFERENCES user_stories(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  frente TEXT NOT NULL CHECK (frente IN ('definicion', 'ux_ui', 'frontend', 'backend', 'testing', 'devops')),
  orden INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_story_id ON tasks(user_story_id);

CREATE TABLE IF NOT EXISTS subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  tiempo_estimado_min INTEGER,
  orden INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);

-- ─────────────────────────────────────────────
-- RLS
-- El backend habla con Supabase usando la service_role key, que ignora RLS.
-- Las políticas abiertas existen para que la anon key siga sirviendo en
-- desarrollo. Restringir al agregar autenticación de usuarios.
-- ─────────────────────────────────────────────
ALTER TABLE work_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE epicas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON work_plans;
DROP POLICY IF EXISTS "Allow all for anon" ON epicas;
DROP POLICY IF EXISTS "Allow all for anon" ON user_stories;
DROP POLICY IF EXISTS "Allow all for anon" ON tasks;
DROP POLICY IF EXISTS "Allow all for anon" ON subtasks;

CREATE POLICY "Allow all for anon" ON work_plans   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON epicas       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON user_stories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON tasks        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON subtasks     FOR ALL USING (true) WITH CHECK (true);
