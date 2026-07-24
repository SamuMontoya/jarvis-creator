import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function addConstraint() {
  console.log('Adding unique constraint...');
  
  // Try to insert duplicate to test
  const { data: ideas } = await supabase.from('ideas').select('id').limit(1);
  const { data: questions } = await supabase.from('generic_questions').select('id').limit(1);
  
  if (!ideas?.length || !questions?.length) {
    console.log('No test data');
    return;
  }
  
  const ideaId = ideas[0].id;
  const questionId = questions[0].id;
  
  // First insert
  const { data: first, error: e1 } = await supabase
    .from('respuestas')
    .insert({ idea_id: ideaId, generic_question_id: questionId, respuesta: 'Test 1' })
    .select()
    .single();
  
  if (e1) return console.log('First insert error:', e1.message);
  console.log('First insert OK:', first.id);
  
  // Second insert (should fail if constraint exists)
  const { data: second, error: e2 } = await supabase
    .from('respuestas')
    .insert({ idea_id: ideaId, generic_question_id: questionId, respuesta: 'Test 2' })
    .select()
    .single();
  
  if (e2) {
    console.log('Second insert correctly fails:', e2.message);
    console.log('Code:', e2.code);
  } else {
    console.log('Second insert succeeded (constraint missing!)');
    await supabase.from('respuestas').delete().eq('id', second.id);
  }
  
  // Cleanup
  await supabase.from('respuestas').delete().eq('id', first.id);
}

addConstraint();
