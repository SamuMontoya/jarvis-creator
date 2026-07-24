import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function fixSchema() {
  console.log('🔧 Arreglando esquema de base de datos...\n');
  
  // We need to use raw SQL via REST API since there's no exec_sql function
  // Let's try using the Supabase SQL editor approach - we'll do ALTER TABLE via the client
  
  // Actually, let's try to add columns using the Supabase client
  // Since we can't execute raw ALTER TABLE, we'll need to use the REST API
  
  // Try to add generic_question_id to respuestas
  // We can't do ALTER TABLE via the client, but we can try inserting with the column to see the error
  
  console.log('Intentando agregar columnas faltantes...');
  console.log('Nota: Supabase no permite ALTER TABLE via client library');
  console.log('Necesitas ejecutar SQL manualmente en el Dashboard de Supabase\n');
  
  // Show the SQL needed
  console.log('--- EJECUTA ESTE SQL EN SUPABASE DASHBOARD -> SQL EDITOR ---\n');
  
  console.log(`-- Agregar columnas faltantes a generic_questions`);
  console.log(`ALTER TABLE generic_questions ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT true;`);
  console.log(`ALTER TABLE generic_questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();\n`);
  
  console.log(`-- Agregar columnas faltantes a respuestas`);
  console.log(`ALTER TABLE respuestas ADD COLUMN IF NOT EXISTS generic_question_id UUID REFERENCES generic_questions(id) ON DELETE CASCADE;`);
  console.log(`ALTER TABLE respuestas ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`);
  console.log(`ALTER TABLE respuestas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();\n`);
  
  console.log(`-- Agregar constraint unique`);
  console.log(`ALTER TABLE respuestas DROP CONSTRAINT IF EXISTS respuestas_idea_id_generic_question_id_key;`);
  console.log(`ALTER TABLE respuestas ADD CONSTRAINT respuestas_idea_id_generic_question_id_key UNIQUE (idea_id, generic_question_id);\n`);
  
  console.log(`-- Actualizar generic_questions existentes`);
  console.log(`UPDATE generic_questions SET activa = true WHERE activa IS NULL;\n`);
  
  console.log(`-- Índices`);
  console.log(`CREATE INDEX IF NOT EXISTS idx_respuestas_question_id ON respuestas(generic_question_id);`);
  
  console.log('\n--- FIN SQL ---');
  
  // Also check if ideas table matches
  console.log('\n⚠️  NOTA: La tabla "ideas" tiene columnas diferentes a las esperadas:');
  console.log('  Esperado por código: id, titulo, descripcion, created_at, updated_at');
  console.log('  Actual en BD: id, texto_idea, md_final, estado, created_at, updated_at');
  console.log('\n  El código usa "texto_idea" que SÍ existe, así que debería funcionar.');
  
  process.exit(0);
}

fixSchema();
