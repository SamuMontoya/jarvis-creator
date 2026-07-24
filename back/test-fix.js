import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Execute raw SQL via fetch to Supabase REST API
async function execSQL(sql) {
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ query: sql }),
  });
  return response;
}

async function fixAndTest() {
  console.log('🔧 Arreglando schema...\n');
  
  // Fix generic_questions
  const fixes = [
    `ALTER TABLE generic_questions ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT true;`,
    `ALTER TABLE generic_questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`,
    `ALTER TABLE respuestas ADD COLUMN IF NOT EXISTS generic_question_id UUID REFERENCES generic_questions(id) ON DELETE CASCADE;`,
    `ALTER TABLE respuestas ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`,
    `ALTER TABLE respuestas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW;`,
    `UPDATE generic_questions SET activa = true WHERE activa IS NULL;`
  ];
  
  for (const sql of fixes) {
    try {
      const res = await execSQL(sql);
      if (!res.ok) {
        const err = await res.json();
        console.log(`⚠ ${sql.substring(0,50)}: ${err.message}`);
      } else {
        console.log(`✓ ${sql.substring(0,50)}`);
      }
    } catch (e) {
      console.log(`⚠ ${e.message}`);
    }
  }
  
  console.log('\n🧪 Probando endpoint...\n');
  
  // Get a question
  const { data: q, error: qErr } = await supabase
    .from('generic_questions')
    .select('id, pregunta')
    .limit(1)
    .single();
  
  if (qErr) return console.log('❌ Pregunta:', qErr.message);
  console.log('Pregunta:', q.id, q.pregunta.substring(0,40));
  
  // Get/create idea
  let idea;
  const { data: ideas } = await supabase.from('ideas').select('id').limit(1);
  if (ideas && ideas.length > 0) {
    idea = ideas[0];
  } else {
    const { data: newIdea } = await supabase
      .from('ideas')
      .insert({ texto_idea: 'Test idea' })
      .select()
      .single();
    idea = newIdea;
  }
  console.log('Idea:', idea.id);
  
  // Test insert into respuestas (what the endpoint does)
  const { data: resp, error: rErr } = await supabase
    .from('respuestas')
    .insert({
      idea_id: idea.id,
      generic_question_id: q.id,
      respuesta: 'Test respuesta'
    })
    .select()
    .single();
  
  if (rErr) {
    console.log('❌ Error insert:', rErr.message);
  } else {
    console.log('✅ Respuesta creada:', resp.id);
    await supabase.from('respuestas').delete().eq('id', resp.id);
    console.log('🧹 Cleaned up');
  }
  
  process.exit(0);
}

fixAndTest();
