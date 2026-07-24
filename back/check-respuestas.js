import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRespuestas() {
  // Try inserting to see columns
  const { data, error } = await supabase
    .from('respuestas')
    .insert({ idea_id: '00000000-0000-0000-0000-000000000000', generic_question_id: '00000000-0000-0000-0000-000000000000', respuesta: 'test' })
    .select()
    .single();
  
  if (error) {
    console.log('Error insert:', error.message);
    console.log('Code:', error.code);
    console.log('Details:', error.details);
    console.log('Hint:', error.hint);
  } else {
    console.log('Inserted:', data);
    await supabase.from('respuestas').delete().eq('id', data.id);
  }
  
  // Try to get columns via postgrest
  const { data: row, error: selError } = await supabase
    .from('respuestas')
    .select('*')
    .limit(1);
  
  console.log('Select error:', selError);
  console.log('Row:', row);
}

checkRespuestas().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
