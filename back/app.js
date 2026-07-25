import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Groq } from 'groq-sdk';
import supabase from './supabaseClient.js';

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    /\.ngrok.*\.app$/
  ]
}));
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('ideas')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    res.json({ status: 'ok', connection: 'verified' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/ideas', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ideas')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    res.json({ status: 'ok', ideas: data || [] });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/ideas', async (req, res) => {
  try {
    const { texto_idea } = req.body;

    if (!texto_idea || typeof texto_idea !== 'string' || texto_idea.trim() === '') {
      return res.status(400).json({ status: 'error', message: 'texto_idea es requerido y no puede estar vacío' });
    }

    const { data, error } = await supabase
      .from('ideas')
      .insert([{ texto_idea: texto_idea.trim() }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    res.status(201).json({ status: 'ok', idea: data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/ideas/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ status: 'error', message: 'id de idea es requerido' });
    }

    const { data: idea, error: ideaError } = await supabase
      .from('ideas')
      .select('*')
      .eq('id', id)
      .single();

    if (ideaError || !idea) {
      return res.status(404).json({ status: 'error', message: 'Idea no encontrada' });
    }

    const { data: respuestas, error: respError } = await supabase
      .from('respuestas')
      .select('*, generic_questions(pregunta, orden)')
      .eq('idea_id', id)
      .order('created_at', { ascending: true });

    if (respError) {
      return res.status(500).json({ status: 'error', message: respError.message });
    }

    res.json({ status: 'ok', idea: { ...idea, respuestas: respuestas || [] } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.patch('/api/ideas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!id) {
      return res.status(400).json({ status: 'error', message: 'id de idea es requerido' });
    }

    if (!estado) {
      return res.status(400).json({ status: 'error', message: 'estado es requerido' });
    }

    const { data, error } = await supabase
      .from('ideas')
      .update({ estado })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    if (!data) {
      return res.status(404).json({ status: 'error', message: 'Idea no encontrada' });
    }

    res.json({ status: 'ok', idea: data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.delete('/api/ideas/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ status: 'error', message: 'id de idea es requerido' });
    }

    // Delete respuestas first (cascade)
    const { error: respError } = await supabase
      .from('respuestas')
      .delete()
      .eq('idea_id', id);

    if (respError) {
      return res.status(500).json({ status: 'error', message: respError.message });
    }

    // Delete idea
    const { error: ideaError } = await supabase
      .from('ideas')
      .delete()
      .eq('id', id);

    if (ideaError) {
      return res.status(500).json({ status: 'error', message: ideaError.message });
    }

    res.json({ status: 'ok', deleted: true });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/respuestas', async (req, res) => {
  try {
    const { idea_id, generic_question_id, respuesta } = req.body;

    if (!idea_id || !generic_question_id || !respuesta) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'idea_id, generic_question_id y respuesta son requeridos' 
      });
    }

    if (typeof respuesta !== 'string' || respuesta.trim() === '') {
      return res.status(400).json({ 
        status: 'error', 
        message: 'respuesta debe ser un string no vacío' 
      });
    }

    const { data, error } = await supabase
      .from('respuestas')
      .insert([{ 
        idea_id, 
        generic_question_id, 
        respuesta: respuesta.trim() 
      }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    res.status(201).json({ status: 'ok', respuesta: data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/ideas/:id/respuestas', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ status: 'error', message: 'id de idea es requerido' });
    }

    const { data: idea, error: ideaError } = await supabase
      .from('ideas')
      .select('id')
      .eq('id', id)
      .single();

    if (ideaError || !idea) {
      return res.status(404).json({ status: 'error', message: 'Idea no encontrada' });
    }

    const { data: respuestas, error } = await supabase
      .from('respuestas')
      .select('*, generic_questions(pregunta, orden)')
      .eq('idea_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    res.json({ status: 'ok', respuestas: respuestas || [] });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/ideas/:id/dynamic-questions', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ status: 'error', message: 'id de idea es requerido' });
    }

    const { data, error } = await supabase
      .from('dynamic_questions')
      .select('*')
      .eq('idea_id', id)
      .order('orden', { ascending: true });

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    res.json({ status: 'ok', dynamic_questions: data || [] });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/ideas/:id/generate-dynamic-questions', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ status: 'error', message: 'id de idea es requerido' });
    }

    // 1. Verificar si ya existen preguntas dinámicas
    const { count, error: countError } = await supabase
      .from('dynamic_questions')
      .select('*', { count: 'exact', head: true })
      .eq('idea_id', id);

    if (countError) {
      return res.status(500).json({ status: 'error', message: countError.message });
    }

    // Si ya existen, retornarlas
    if (count && count > 0) {
      const { data: existing, error: fetchError } = await supabase
        .from('dynamic_questions')
        .select('*')
        .eq('idea_id', id)
        .order('orden', { ascending: true });

      if (fetchError) {
        return res.status(500).json({ status: 'error', message: fetchError.message });
      }

      return res.json({ status: 'ok', dynamic_questions: existing || [] });
    }

    // 2. Obtener idea + respuestas genéricas + preguntas genéricas
    const { data: idea, error: ideaError } = await supabase
      .from('ideas')
      .select('*')
      .eq('id', id)
      .single();

    if (ideaError || !idea) {
      return res.status(404).json({ status: 'error', message: 'Idea no encontrada' });
    }

    const { data: respuestas, error: respError } = await supabase
      .from('respuestas')
      .select('*, generic_questions(pregunta, orden)')
      .eq('idea_id', id)
      .order('created_at', { ascending: true });

    if (respError) {
      return res.status(500).json({ status: 'error', message: respError.message });
    }

    // 3. Construir prompt (igual que test-groq.js)
    const mockAnswers = (respuestas || []).map(r => r.respuesta);
    
    const prompt = `Genera exactamente 10 preguntas específicas y profundas para refinar esta idea de negocio.

IDEA: "${idea.texto_idea}"

RESPUESTAS PREVIAS:
${mockAnswers.map((ans, i) => `${i + 1}. ${ans}`).join('\n')}

INSTRUCCIONES:
- Las preguntas deben ser específicas, no genéricas
- Deben profundizar en aspectos no cubiertos aún
- Formato de respuesta OBLIGATORIO: JSON válido con clave "questions" que es un array de 10 objetos, cada uno con clave "pregunta"
- NO incluyas texto adicional, solo el JSON

EJEMPLO FORMATO:
{"questions": [{"pregunta": "..."}, {"pregunta": "..."}, ...]}`;

    // 4. Llamar a Groq
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'Eres un experto en descubrimiento de productos y validación de ideas de negocio. Generas preguntas precisas en formato JSON estricto.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      return res.status(500).json({ status: 'error', message: 'Respuesta vacía de Groq' });
    }

    // 5. Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch (e) {
      return res.status(500).json({ status: 'error', message: 'JSON inválido de Groq: ' + e.message });
    }

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      return res.status(500).json({ status: 'error', message: 'Falta clave "questions" o no es array' });
    }

    // 6. INSERT INTO dynamic_questions
    const questionsToInsert = parsed.questions.map((q, idx) => ({
      idea_id: id,
      pregunta: q.pregunta,
      orden: idx + 1,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('dynamic_questions')
      .insert(questionsToInsert)
      .select();

    if (insertError) {
      return res.status(500).json({ status: 'error', message: insertError.message });
    }

    // 7. Retornar preguntas guardadas
    res.json({ status: 'ok', dynamic_questions: inserted || [] });

  } catch (err) {
    console.error('Error en generate-dynamic-questions:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/dynamic-respuestas', async (req, res) => {
  try {
    const { idea_id, dynamic_question_id, respuesta } = req.body;

    // Validar campos requeridos
    if (!idea_id || !dynamic_question_id || !respuesta) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing fields: idea_id, dynamic_question_id, respuesta son requeridos' 
      });
    }

    if (typeof respuesta !== 'string' || respuesta.trim() === '') {
      return res.status(400).json({ 
        status: 'error', 
        message: 'respuesta debe ser un string no vacío' 
      });
    }

    // Verificar que idea_id existe
    const { data: idea, error: ideaError } = await supabase
      .from('ideas')
      .select('id')
      .eq('id', idea_id)
      .single();

    if (ideaError || !idea) {
      return res.status(404).json({ status: 'error', message: 'ID not found: idea_id no existe' });
    }

    // Verificar que dynamic_question_id existe
    const { data: dq, error: dqError } = await supabase
      .from('dynamic_questions')
      .select('id')
      .eq('id', dynamic_question_id)
      .single();

    if (dqError || !dq) {
      return res.status(404).json({ status: 'error', message: 'ID not found: dynamic_question_id no existe' });
    }

    // INSERT INTO dynamic_respuestas
    const { data, error } = await supabase
      .from('dynamic_respuestas')
      .insert([{ 
        idea_id, 
        dynamic_question_id, 
        respuesta: respuesta.trim() 
      }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    res.status(201).json({ status: 'ok', respuesta: data });

  } catch (err) {
    console.error('Error en dynamic-respuestas:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/ideas/:id/dynamic-respuestas', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ status: 'error', message: 'id de idea es requerido' });
    }

    const { data, error } = await supabase
      .from('dynamic_respuestas')
      .select(`
        *,
        dynamic_questions!inner(pregunta, orden)
      `)
      .eq('idea_id', id)
      .order('dynamic_questions(orden)', { ascending: true });

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    // Transformar para incluir pregunta al nivel superior
    const formatted = (data || []).map(r => ({
      ...r,
      pregunta: r.dynamic_questions?.pregunta,
      orden: r.dynamic_questions?.orden,
      dynamic_questions: undefined
    }));

    res.json({ status: 'ok', dynamic_respuestas: formatted });

  } catch (err) {
    console.error('Error en dynamic-respuestas GET:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/questions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('generic_questions')
      .select('*')
      .order('orden', { ascending: true });

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('Could not find the table')) {
        return res.json({ status: 'ok', questions: [] });
      }
      return res.status(500).json({ status: 'error', message: error.message });
    }

    res.json({ status: 'ok', questions: data || [] });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/ideas/:id/generate-final-html', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ status: 'error', message: 'id de idea es requerido' });
    }

    // 1. GET idea
    const { data: idea, error: ideaError } = await supabase
      .from('ideas')
      .select('*')
      .eq('id', id)
      .single();

    if (ideaError || !idea) {
      return res.status(404).json({ status: 'error', message: 'Idea no encontrada' });
    }

    // 2. GET generic preguntas + respuestas
    const { data: genQuestions, error: genQError } = await supabase
      .from('generic_questions')
      .select('*')
      .order('orden', { ascending: true });

    if (genQError) {
      return res.status(500).json({ status: 'error', message: genQError.message });
    }

    const { data: genRespuestas, error: genRError } = await supabase
      .from('respuestas')
      .select('*, generic_questions(pregunta, orden)')
      .eq('idea_id', id)
      .order('created_at', { ascending: true });

    if (genRError) {
      return res.status(500).json({ status: 'error', message: genRError.message });
    }

    // 3. GET dynamic preguntas + respuestas
    const { data: dynQuestions, error: dynQError } = await supabase
      .from('dynamic_questions')
      .select('*')
      .eq('idea_id', id)
      .order('orden', { ascending: true });

    if (dynQError) {
      return res.status(500).json({ status: 'error', message: dynQError.message });
    }

    const { data: dynRespuestas, error: dynRError } = await supabase
      .from('dynamic_respuestas')
      .select(`
        *,
        dynamic_questions!inner(pregunta, orden)
      `)
      .eq('idea_id', id)
      .order('dynamic_questions(orden)', { ascending: true });

    if (dynRError) {
      return res.status(500).json({ status: 'error', message: dynRError.message });
    }

    // 4. Build HTML
    const escapeHtml = (str) => {
      if (!str) return '';
      return str
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#039;');
    };

    const formatDate = () => new Date().toLocaleString('es-ES', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    // Build generic section
    const genericSection = (genRespuestas || []).map((resp, idx) => {
      const pregunta = resp.generic_questions?.pregunta || `Pregunta ${idx + 1}`;
      return `
        <div class="question"><strong>Pregunta ${idx + 1}:</strong> ${escapeHtml(pregunta)}</div>
        <div class="answer">${escapeHtml(resp.respuesta || '')}</div>
      `;
    }).join('');

    // Build dynamic section
    const dynamicSection = (dynRespuestas || []).map((resp, idx) => {
      const pregunta = resp.dynamic_questions?.pregunta || resp.pregunta || `Pregunta ${idx + 1}`;
      return `
        <div class="question"><strong>Pregunta ${idx + 1}:</strong> ${escapeHtml(pregunta)}</div>
        <div class="answer">${escapeHtml(resp.respuesta || '')}</div>
      `;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(idea.texto_idea)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 900px; margin: 40px auto; line-height: 1.7; color: #333; padding: 0 20px; }
    h1 { color: #1a1a1a; border-bottom: 3px solid #007bff; padding-bottom: 15px; margin-bottom: 30px; font-size: 2rem; }
    h2 { color: #444; margin-top: 40px; margin-bottom: 20px; padding-bottom: 8px; border-bottom: 2px solid #e0e0e0; font-size: 1.5rem; }
    .question { background: #f8f9fa; padding: 18px 22px; border-left: 5px solid #007bff; margin: 20px 0; border-radius: 0 8px 8px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .question strong { color: #0056b3; font-size: 1.05rem; }
    .answer { background: #e7f3ff; padding: 18px 22px; margin: 10px 0 25px 0; border-radius: 8px; border: 1px solid #b8daff; white-space: pre-wrap; font-size: 1rem; }
    .timestamp { color: #999; font-size: 12px; margin-top: 60px; text-align: center; padding-top: 20px; border-top: 1px solid #e0e0e0; }
    .meta { background: #f0f4f8; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #d0d9e2; }
    .meta p { margin: 8px 0; }
    .meta strong { color: #333; }
  </style>
</head>
<body>
  <h1>${escapeHtml(idea.texto_idea)}</h1>
  
  <div class="meta">
    <p><strong>Estado:</strong> ${escapeHtml(idea.estado || 'draft')}</p>
    <p><strong>Creada:</strong> ${idea.created_at ? new Date(idea.created_at).toLocaleString('es-ES') : 'N/A'}</p>
  </div>

  <h2>Definición (Descubrimiento Inicial)</h2>
  <div>${genericSection || '<p style="color: #999;">No hay respuestas genéricas registradas</p>'}</div>

  <h2>Análisis Profundo</h2>
  <div>${dynamicSection || '<p style="color: #999;">No hay respuestas dinámicas registradas</p>'}</div>

  <div class="timestamp">Generado el ${formatDate()}</div>
</body>
</html>`;

    // 5. PATCH ideas SET md_final = :html WHERE id = :id
    const { error: updateError } = await supabase
      .from('ideas')
      .update({ md_final: html })
      .eq('id', id);

    if (updateError) {
      console.warn('No se pudo guardar md_final:', updateError.message);
    }

    res.json({ status: 'ok', html });

  } catch (err) {
    console.error('Error en generate-final-html:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/ideas/:id/generate-final-markdown', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ status: 'error', message: 'id de idea es requerido' });
    }

    // Reutilizar la lógica de fetch de datos (similar a generate-final-html)
    const { data: idea, error: ideaError } = await supabase
      .from('ideas')
      .select('*')
      .eq('id', id)
      .single();

    if (ideaError || !idea) {
      return res.status(404).json({ status: 'error', message: 'Idea no encontrada' });
    }

    const { data: genRespuestas, error: genRError } = await supabase
      .from('respuestas')
      .select('*, generic_questions(pregunta, orden)')
      .eq('idea_id', id)
      .order('created_at', { ascending: true });

    if (genRError) {
      return res.status(500).json({ status: 'error', message: genRError.message });
    }

    const { data: dynRespuestas, error: dynRError } = await supabase
      .from('dynamic_respuestas')
      .select(`
        *,
        dynamic_questions!inner(pregunta, orden)
      `)
      .eq('idea_id', id)
      .order('dynamic_questions(orden)', { ascending: true });

    if (dynRError) {
      return res.status(500).json({ status: 'error', message: dynRError.message });
    }

    const escapeMd = (str) => {
      if (!str) return '';
      return str
        .replace(/\\/g, '\\\\')
        .replace(/\*/g, '\\*')
        .replace(/_/g, '\\_')
        .replace(/#/g, '\\#')
        .replace(/`/g, '\\`');
    };

    const formatDate = () => new Date().toLocaleString('es-ES', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    // Build generic section
    const genericSection = (genRespuestas || []).map((resp, idx) => {
      const pregunta = resp.generic_questions?.pregunta || `Pregunta ${idx + 1}`;
      return `### Pregunta ${idx + 1}: ${escapeMd(pregunta)}\n\n${escapeMd(resp.respuesta || '')}\n`;
    }).join('\n');

    // Build dynamic section
    const dynamicSection = (dynRespuestas || []).map((resp, idx) => {
      const pregunta = resp.dynamic_questions?.pregunta || resp.pregunta || `Pregunta ${idx + 1}`;
      return `### Pregunta ${idx + 1}: ${escapeMd(pregunta)}\n\n${escapeMd(resp.respuesta || '')}\n`;
    }).join('\n');

    const markdown = `# ${escapeMd(idea.texto_idea)}

## Información
- **Estado:** ${escapeMd(idea.estado || 'draft')}
- **Creada:** ${idea.created_at ? new Date(idea.created_at).toLocaleString('es-ES') : 'N/A'}
- **Generado:** ${formatDate()}

---

## Definición (Descubrimiento Inicial)

${genericSection || '*No hay respuestas genéricas registradas*'}

---

## Análisis Profundo

${dynamicSection || '*No hay respuestas dinámicas registradas*'}

---

*Generado por JARVIS Creator el ${formatDate()}*`;

    res.json({ status: 'ok', markdown });

  } catch (err) {
    console.error('Error en generate-final-markdown:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/ideas/:id/generate-final-pdf', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ status: 'error', message: 'id de idea es requerido' });
    }

    // Fetch data (reutilizar lógica)
    const { data: idea, error: ideaError } = await supabase
      .from('ideas')
      .select('*')
      .eq('id', id)
      .single();

    if (ideaError || !idea) {
      return res.status(404).json({ status: 'error', message: 'Idea no encontrada' });
    }

    const { data: genRespuestas, error: genRError } = await supabase
      .from('respuestas')
      .select('*, generic_questions(pregunta, orden)')
      .eq('idea_id', id)
      .order('created_at', { ascending: true });

    if (genRError) {
      return res.status(500).json({ status: 'error', message: genRError.message });
    }

    const { data: dynRespuestas, error: dynRError } = await supabase
      .from('dynamic_respuestas')
      .select(`
        *,
        dynamic_questions!inner(pregunta, orden)
      `)
      .eq('idea_id', id)
      .order('dynamic_questions(orden)', { ascending: true });

    if (dynRError) {
      return res.status(500).json({ status: 'error', message: dynRError.message });
    }

    // Generar Markdown primero
    const escapeMd = (str) => {
      if (!str) return '';
      return str
        .replace(/\\/g, '\\\\')
        .replace(/\*/g, '\\*')
        .replace(/_/g, '\\_')
        .replace(/#/g, '\\#')
        .replace(/`/g, '\\`');
    };

    const formatDate = () => new Date().toLocaleString('es-ES', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const genericSection = (genRespuestas || []).map((resp, idx) => {
      const pregunta = resp.generic_questions?.pregunta || `Pregunta ${idx + 1}`;
      return `### Pregunta ${idx + 1}: ${escapeMd(pregunta)}\n\n${escapeMd(resp.respuesta || '')}\n`;
    }).join('\n');

    const dynamicSection = (dynRespuestas || []).map((resp, idx) => {
      const pregunta = resp.dynamic_questions?.pregunta || resp.pregunta || `Pregunta ${idx + 1}`;
      return `### Pregunta ${idx + 1}: ${escapeMd(pregunta)}\n\n${escapeMd(resp.respuesta || '')}\n`;
    }).join('\n');

    const markdown = `# ${escapeMd(idea.texto_idea)}

## Información
- **Estado:** ${escapeMd(idea.estado || 'draft')}
- **Creada:** ${idea.created_at ? new Date(idea.created_at).toLocaleString('es-ES') : 'N/A'}
- **Generado:** ${formatDate()}

---

## Definición (Descubrimiento Inicial)

${genericSection || '*No hay respuestas genéricas registradas*'}

---

## Análisis Profundo

${dynamicSection || '*No hay respuestas dinámicas registradas*'}

---

*Generado por JARVIS Creator el ${formatDate()}*`;

    // Convertir Markdown a PDF usando jsPDF (server-side)
    // Usamos una aproximación simple: generamos HTML y usamos una librería
    // Para simplificar, retornamos el markdown y el front lo convierte a PDF
    // O usamos una aproximación básica con texto plano

    // Retornamos el markdown y el front usa jspdf para crear PDF
    res.json({ status: 'ok', markdown });

  } catch (err) {
    console.error('Error en generate-final-pdf:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

export default app;