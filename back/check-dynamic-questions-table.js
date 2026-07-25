import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔄 Verificando si tabla dynamic_questions existe...\n');
  
  // Verificar si la tabla existe
  const { data, error, count } = await supabase
    .from('dynamic_questions')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
      console.log('⚠️ Tabla dynamic_questions NO existe');
      console.log('\n📋 Para crearla, ejecuta este SQL en el SQL Editor de Supabase Dashboard:');
      console.log('\n--- SQL ---');
      console.log(`
CREATE TABLE IF NOT EXISTS dynamic_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  pregunta TEXT NOT NULL,
  orden INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dynamic_questions_idea_id ON dynamic_questions(idea_id);
      `);
      console.log('--- FIN SQL ---');
      console.log('\n👉 Ve a: https://supabase.com/dashboard/project/evajjhjzccbexwmcuppq/sql/new');
    } else {
      console.log('❌ Error:', error.message);
    }
  } else {
    console.log('✅ Tabla dynamic_questions YA EXISTE y es accesible');
    console.log(`   Registros actuales: ${count}`);
  }
}

main().catch(console.error);