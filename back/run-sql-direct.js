import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSQL(sql) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
    },
    body: JSON.stringify({ sql }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`${response.status}: ${error.message}`);
  }
  
  return response.json();
}

async function main() {
  console.log('🔄 Recreando tablas...\n');
  
  // Drop tables first (in correct order due to FK)
  const drops = [
    'DROP TABLE IF EXISTS respuestas CASCADE;',
    'DROP TABLE IF EXISTS generic_questions CASCADE;',
    'DROP TABLE IF EXISTS ideas CASCADE;',
  ];
  
  for (const sql of drops) {
    try {
      await runSQL(sql);
      console.log(`✓ ${sql.substring(0, 50)}...`);
    } catch (e) {
      console.log(`⚠ ${e.message}`);
    }
  }
  
  // Now create tables
  const creates = `
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

-- Políticas RLS (permitir todo por ahora)
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
  `;
  
  try {
    await runSQL(creates);
    console.log('✅ Tablas creadas exitosamente');
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
  
  // Verify tables
  console.log('\n🔍 Verificando tablas...');
  const tables = ['generic_questions', 'ideas', 'respuestas'];
  
  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      console.log(`✅ ${table}: ${count} registros`);
    }
  }
  
  // Test insert into respuestas
  console.log('\n🧪 Probando inserción en respuestas...');
  
  // First create an idea
  const { data: idea, error: ideaError } = await supabase
    .from('ideas')
    .insert({ titulo: 'Test Idea', descripcion: 'Test' })
    .select()
    .single();
  
  if (ideaError) {
    console.error('❌ Error creando idea:', ideaError.message);
  } else {
    console.log('✅ Idea creada:', idea.id);
    
    // Get a question
    const { data: question, error: qError } = await supabase
      .from('generic_questions')
      .select('id')
      .limit(1)
      .single();
    
    if (qError) {
      console.error('❌ Error obteniendo pregunta:', qError.message);
    } else {
      console.log('✅ Pregunta:', question.id);
      
      // Insert respuesta
      const { data: resp, error: respError } = await supabase
        .from('respuestas')
        .insert({
          idea_id: idea.id,
          generic_question_id: question.id,
          respuesta: 'Mi respuesta de prueba'
        })
        .select()
        .single();
      
      if (respError) {
        console.error('❌ Error insertando respuesta:', respError.message);
      } else {
        console.log('✅ Respuesta insertada:', resp.id);
      }
    }
  }
  
  console.log('\n✅ Completo');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
