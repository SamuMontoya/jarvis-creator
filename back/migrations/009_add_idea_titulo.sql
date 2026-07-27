-- Añade un título corto a la idea, independiente de la descripción larga
-- (texto_idea). Nullable + backfill: las ideas existentes toman como título
-- los primeros caracteres de su texto_idea para no romper filas ya creadas.
-- Ejecutar en: Supabase Dashboard > SQL Editor.

ALTER TABLE ideas ADD COLUMN IF NOT EXISTS titulo TEXT;

UPDATE ideas
SET titulo = LEFT(texto_idea, 80)
WHERE titulo IS NULL;

ALTER TABLE ideas ALTER COLUMN titulo SET NOT NULL;
