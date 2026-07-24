import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function checkSchema() {
  // Get column info for each table
  const tables = ['generic_questions', 'ideas', 'respuestas'];
  
  for (const table of tables) {
    console.log(`\n📋 ${table}:`);
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`  Error: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log('  Columnas:', Object.keys(data[0]).join(', '));
    } else {
      console.log('  (vacía)');
    }
  }
}

checkSchema();
