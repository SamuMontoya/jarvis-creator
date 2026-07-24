import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testEndpoint() {
  console.log('🔍 Verificando datos en tablas...\n');
  
  // Verificar generic_questions
  const { data: questions, error: qError } = await supabase
    .from('generic_questions')
    .select('*')
    .order('orden', { ascending: true });
  
  if (qError) {
    console.error('❌ Error questions:', qError.message);
  } else {
    console.log(`📋 Preguntas genéricas (${questions.length}):`);
    questions.forEach(q => console.log(`  ${q.orden}. ${q.pregunta.substring(0, 50)}...`));
  }
  
  // Verificar ideas
  const { data: ideas, error: iError } = await supabase
    .from('ideas')
    .select('*');
  
  if (iError) {
    console.error('❌ Error ideas:', iError.message);
  } else {
    console.log(`\n💡 Ideas (${ideas.length}):`);
    ideas.forEach(idea => console.log(`  - ${idea.titulo}: ${idea.descripcion?.substring(0, 50)}...`));
  }
  
  // Verificar respuestas
  const { data: respuestas, error: rError } = await supabase
    .from('respuestas')
    .select('*');
  
  if (rError) {
    console.error('❌ Error respuestas:', rError.message);
  } else {
    console.log(`\n📝 Respuestas (${respuestas.length}):`);
    respuestas.forEach(r => console.log(`  - idea:${r.idea_id} q:${r.generic_question_id} "${r.respuesta.substring(0, 30)}..."`));
  }
  
  // Test POST /api/respuestas via direct insert
  console.log('\n🧪 Probando inserción de respuesta...');
  
  if (questions.length > 0 && ideas.length > 0) {
    const testIdea = ideas[0];
    const testQuestion = questions[0];
    
    const { data: newResp, error: insertError } = await supabase
      .from('respuestas')
      .insert({
        idea_id: testIdea.id,
        generic_question_id: testQuestion.id,
        respuesta: 'Respuesta de prueba desde script'
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Error insertando:', insertError.message);
    } else {
      console.log('✅ Respuesta insertada:', newResp);
      
      // Cleanup
      await supabase.from('respuestas').delete().eq('id', newResp.id);
      console.log('🧹 Limpieza completada');
    }
  } else {
    console.log('⚠️  Faltan datos de prueba (ideas o preguntas)');
  }
}

testEndpoint().then(() => process.exit(0)).catch(err => {
  console.error('❌', err);
  process.exit(1);
});
