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

const sql = `
CREATE TABLE IF NOT EXISTS dynamic_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  pregunta TEXT NOT NULL,
  orden INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dynamic_questions_idea_id ON dynamic_questions(idea_id);
`;

async function executeSQL(sql) {
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
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

async function main() {
  console.log('🔄 Creando tabla dynamic_questions...\n');
  
  try {
    await executeSQL(sql);
    console.log('✅ Tabla dynamic_questions creada correctamente');
    
    // Verificar que existe
    const { data, error } = await supabase
      .from('dynamic_questions')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log('⚠️ Tabla creada pero error al verificar:', error.message);
    } else {
      console.log('✅ Verificación exitosa - tabla existe y es accesible');
    }
  } catch (err) {
    if (err.message.includes('function') && err.message.includes('exec_sql')) {
      console.log('⚠️ RPC exec_sql no disponible, intentando método alternativo...');
      
      // Método alternativo: usar PostgREST directo
      const statements = sql.split(';').map(s => s.trim()).filter(s => s);
      
      for (const stmt of statements) {
        try {
          const response = await fetch(`${supabaseUrl}/rest/v1/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ query: stmt }),
          });
          
          if (!response.ok) {
            const error = await response.json();
            if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
              console.log('  ⚠ Ya existe');
            } else {
              console.log(`  ❌ ${error.message}`);
            }
          } else {
            console.log('  ✓ OK');
          }
        } catch (e) {
          console.log(`  ❌ ${e.message}`);
        }
      }
      
      // Verificar
      const { data, error } = await supabase
        .from('dynamic_questions')
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log('✅ Verificación exitosa - tabla existe y es accesible');
      }
    } else {
      console.error('❌ Error:', err.message);
    }
  }
}

main().catch(console.error);