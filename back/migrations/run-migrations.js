import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno SUPABASE_URL o SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function execSQL(sql) {
  // Usar la API REST de Supabase para ejecutar SQL raw
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }
  
  return response.json();
}

async function runMigrations() {
  console.log('🔄 Ejecutando migraciones en Supabase...\n');
  
  const migrationFiles = fs.readdirSync('./migrations')
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    console.log(`📄 Ejecutando: ${file}`);
    const sql = fs.readFileSync(`./migrations/${file}`, 'utf8');
    
    // Dividir por ; pero mantener los que están en strings
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (!statement) continue;
      
      try {
        await execSQL(statement + ';');
        console.log(`  ✓ OK`);
      } catch (err) {
        // Ignorar errores de "already exists"
        if (err.message.includes('already exists') || 
            err.message.includes('already exists') ||
            err.message.includes('duplicate key') ||
            err.message.includes('PGRST116')) {
          console.log(`  ⚠  Ya existe (ignorando)`);
        } else {
          console.error(`  ❌ Error: ${err.message}`);
          console.error(`     SQL: ${statement.substring(0, 80)}...`);
        }
      }
    }
  }
  
  console.log('\n✅ Migraciones completadas');
  process.exit(0);
}

runMigrations().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
