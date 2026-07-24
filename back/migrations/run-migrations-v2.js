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

async function runMigrations() {
  console.log('🔄 Ejecutando migraciones en Supabase...\n');
  
  const migrationFiles = fs.readdirSync('./migrations')
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    console.log(`📄 Ejecutando: ${file}`);
    const sql = fs.readFileSync(`./migrations/${file}`, 'utf8');
    
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (!statement) continue;
      
      try {
        // Usar la función SQL de Supabase (pg_exec o similar)
        const { data, error } = await supabase.rpc('pg_exec', { query: statement + ';' });
        
        if (error) {
          // Si no existe pg_exec, la tabla no existe o error de sintaxis
          if (error.code === 'PGRST202' || error.message.includes('function') || error.message.includes('does not exist')) {
            console.log(`  ⚠  Función pg_exec no disponible, saltando...`);
            break;
          }
          // Ignorar errores de "already exists"
          if (error.message.includes('already exists') || 
              error.message.includes('duplicate key') ||
              error.message.includes('PGRST116')) {
            console.log(`  ⚠  Ya existe (ignorando)`);
          } else {
            console.error(`  ❌ Error: ${error.message}`);
            console.error(`     SQL: ${statement.substring(0, 80)}...`);
          }
        } else {
          console.log(`  ✓ OK`);
        }
      } catch (err) {
        if (err.message.includes('already exists') || 
            err.message.includes('duplicate key')) {
          console.log(`  ⚠  Ya existe (ignorando)`);
        } else {
          console.error(`  ❌ Error: ${err.message}`);
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
