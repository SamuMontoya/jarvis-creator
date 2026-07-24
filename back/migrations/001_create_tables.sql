-- Crear tabla de preguntas genéricas
CREATE TABLE IF NOT EXISTS generic_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pregunta TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear tabla de ideas
CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear tabla de respuestas
CREATE TABLE IF NOT EXISTS respuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  generic_question_id UUID NOT NULL REFERENCES generic_questions(id) ON DELETE CASCADE,
  respuesta TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(idea_id, generic_question_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_respuestas_idea_id ON respuestas(idea_id);
CREATE INDEX IF NOT EXISTS idx_respuestas_question_id ON respuestas(generic_question_id);
CREATE INDEX IF NOT EXISTS idx_generic_questions_orden ON generic_questions(orden);

-- Habilitar RLS
ALTER TABLE generic_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE respuestas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (permitir todo por ahora - ajustar según auth)
CREATE POLICY "Allow all for anon" ON generic_questions FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON ideas FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON respuestas FOR ALL USING (true);

-- Insertar preguntas genéricas de ejemplo
INSERT INTO generic_questions (pregunta, orden, activa) VALUES
('¿Cuál es el problema principal que resuelve tu idea?', 1, true),
('¿Quién es tu cliente ideal?', 2, true),
('¿Cuál es tu propuesta de valor única?', 3, true),
('¿Cuál es tu modelo de negocio?', 4, true),
('¿Cuáles son tus principales competidores?', 5, true),
('¿Cuál es tu estrategia de go-to-market?', 6, true),
('¿Qué métricas usarás para medir el éxito?', 7, true),
('¿Cuál es tu presupuesto inicial?', 8, true)
ON CONFLICT DO NOTHING;
