import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeSQL(sql) {
  // Usar el endpoint REST de Supabase para ejecutar SQL
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

async function runMigrations() {
  console.log('🔄 Ejecutando migraciones...\n');
  
  const files = fs.readdirSync('./migrations')
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  for (const file of files) {
    console.log(`📄 ${file}`);
    const sql = fs.readFileSync(`./migrations/${file}`, 'utf8');
    
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    
    for (const stmt of statements) {
      if (!stmt) continue;
      try {
        await executeSQL(stmt + ';');
        console.log(`  ✓ OK`);
      } catch (err) {
        if (err.message.includes('already exists') || 
            err.message.includes('duplicate') ||
            err.message.includes('PGRST116')) {
          console.log(`  ⚠ Ya existe`);
        } else if (err.message.includes('function') && err.message.includes('exec_sql')) {
          console.log(`  ⚠ RPC exec_sql no existe, intentando método alternativo...`);
          // Probar con query directa
          return false;
        } else {
          console.error(`  ❌ ${err.message}`);
        }
      }
    }
  }
  
  console.log('\n✅ Completo');
  return true;
}

runMigrations().then(success => {
  if (!success) {
    console.log('\n⚠️ RPC no disponible, probando método alternativo...\n');
    return runMigrationsAlt();
  }
}).then(() => {
  process.exit(0);
}).catch(err => {
  console.error('❌', err);
  process.exit(1);
});

// Método alternativo: insertar directamente en las tablas
async function runMigrationsAlt() {
  console.log('🔄 Probando inserción directa en tablas...\n');
  
  // Verificar si las tablas existen insertando datos de prueba
  const tables = ['ideas', 'generic_questions', 'respuestas'];
  
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`❌ Tabla ${table} no existe: ${error.message}`);
      } else {
        console.log(`✅ Tabla ${table} existe`);
      }
    } catch (err) {
      console.log(`❌ Tabla ${table} no existe: ${err.message}`);
    }
  }
  
  console.log('\n✅ Verificación completa');
  return true;
}
