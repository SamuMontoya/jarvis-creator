-- Corrige un drift entre los CHECK constraints de estado ya aplicados en la
-- base y lo que definen 004-007: 'pendiente' y 'en_progreso' funcionan, pero
-- 'completada' viola el constraint en las 4 tablas (epicas, user_stories,
-- tasks, subtasks). Las migraciones anteriores usaban
-- "IF NOT EXISTS (... conname = ...)" para ser idempotentes, pero eso solo
-- protege contra re-crear el constraint — si ya existía uno con el mismo
-- nombre pero valores distintos, se quedó silenciosamente desactualizado.
--
-- Esta migración fuerza la definición correcta sin depender de si el
-- constraint ya existía o no. Ejecutar en: Supabase Dashboard > SQL Editor.

ALTER TABLE epicas DROP CONSTRAINT IF EXISTS epicas_estado_check;
ALTER TABLE epicas ADD CONSTRAINT epicas_estado_check
  CHECK (estado IN ('pendiente', 'en_progreso', 'completada'));

ALTER TABLE user_stories DROP CONSTRAINT IF EXISTS user_stories_estado_check;
ALTER TABLE user_stories ADD CONSTRAINT user_stories_estado_check
  CHECK (estado IN ('pendiente', 'en_progreso', 'completada'));

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_estado_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_estado_check
  CHECK (estado IN ('pendiente', 'en_progreso', 'completada'));

ALTER TABLE subtasks DROP CONSTRAINT IF EXISTS subtasks_estado_check;
ALTER TABLE subtasks ADD CONSTRAINT subtasks_estado_check
  CHECK (estado IN ('pendiente', 'en_progreso', 'completada'));

-- Verificación (debe devolver 4 filas, todas con la misma definición)
SELECT conrelid::regclass AS tabla, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conname IN (
  'epicas_estado_check', 'user_stories_estado_check',
  'tasks_estado_check', 'subtasks_estado_check'
);
