import express from 'express';
import { Groq } from 'groq-sdk';
import supabase from '../supabaseClient.js';
import { dynamicRespuestaSchema, firstValidationMessage } from '../validators.js';
import { HTTP_STATUS, MESSAGES, GROQ_MODEL, DYNAMIC_QUESTIONS_COUNT } from '../config.js';
import { sendDbError } from '../errorHandler.js';
import { logger } from '../logger.js';

const router = express.Router();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT =
  'Eres un experto en descubrimiento de productos y validación de ideas de negocio. ' +
  'Generas preguntas precisas en formato JSON estricto.';

const buildPrompt = (idea, respuestas) => `Genera exactamente ${DYNAMIC_QUESTIONS_COUNT} preguntas específicas y profundas para refinar esta idea de negocio.

IDEA: "${idea.texto_idea}"

RESPUESTAS PREVIAS:
${respuestas.map((r, i) => `${i + 1}. ${r.generic_questions?.pregunta ?? ''} → ${r.respuesta}`).join('\n')}

INSTRUCCIONES:
- Las preguntas deben ser específicas, no genéricas
- Deben profundizar en aspectos no cubiertos aún
- Formato de respuesta OBLIGATORIO: JSON válido con clave "questions" que es un array de ${DYNAMIC_QUESTIONS_COUNT} objetos, cada uno con clave "pregunta"
- NO incluyas texto adicional, solo el JSON

EJEMPLO FORMATO:
{"questions": [{"pregunta": "..."}, {"pregunta": "..."}, ...]}`;

async function askGroqForQuestions(idea, respuestas) {
  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(idea, respuestas) },
    ],
    model: GROQ_MODEL,
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Groq returned an empty completion');

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.questions)) {
    throw new Error('Groq response is missing a "questions" array');
  }

  const questions = parsed.questions
    .map((q) => q?.pregunta)
    .filter((pregunta) => typeof pregunta === 'string' && pregunta.trim().length > 0);

  if (questions.length === 0) throw new Error('Groq returned no usable questions');

  return questions.slice(0, DYNAMIC_QUESTIONS_COUNT);
}

router.get('/ideas/:id/dynamic-questions', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('dynamic_questions')
      .select('*')
      .eq('idea_id', req.params.id)
      .order('orden', { ascending: true });

    if (error) {
      return sendDbError(res, error, 'GET /ideas/:id/dynamic-questions');
    }

    res.json({ status: 'ok', dynamic_questions: data || [] });
  } catch (err) {
    next(err);
  }
});

router.post('/ideas/:id/generate-dynamic-questions', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Generation is expensive and non-deterministic: reuse what's already stored.
    const { data: existing, error: existingError } = await supabase
      .from('dynamic_questions')
      .select('*')
      .eq('idea_id', id)
      .order('orden', { ascending: true });

    if (existingError) {
      return sendDbError(res, existingError, 'generate-dynamic-questions (existing lookup)');
    }

    if (existing?.length > 0) {
      return res.json({ status: 'ok', dynamic_questions: existing });
    }

    const { data: idea, error: ideaError } = await supabase
      .from('ideas')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (ideaError) {
      return sendDbError(res, ideaError, 'generate-dynamic-questions (idea lookup)');
    }

    if (!idea) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ status: 'error', message: MESSAGES.IDEA_NOT_FOUND });
    }

    const { data: respuestas, error: respError } = await supabase
      .from('respuestas')
      .select('*, generic_questions(pregunta, orden)')
      .eq('idea_id', id)
      .order('created_at', { ascending: true });

    if (respError) {
      return sendDbError(res, respError, 'generate-dynamic-questions (respuestas lookup)');
    }

    if (!respuestas?.length) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ status: 'error', message: MESSAGES.NO_ANSWERS_YET });
    }

    let questions;
    try {
      questions = await askGroqForQuestions(idea, respuestas);
    } catch (groqError) {
      logger.error('Groq generation failed', groqError);
      return res
        .status(HTTP_STATUS.SERVER_ERROR)
        .json({ status: 'error', message: MESSAGES.GROQ_ERROR });
    }

    const { data: inserted, error: insertError } = await supabase
      .from('dynamic_questions')
      .upsert(
        questions.map((pregunta, idx) => ({ idea_id: id, pregunta, orden: idx + 1 })),
        { onConflict: 'idea_id,orden' }
      )
      .select()
      .order('orden', { ascending: true });

    if (insertError) {
      return sendDbError(res, insertError, 'generate-dynamic-questions (insert)');
    }

    res.json({ status: 'ok', dynamic_questions: inserted || [] });
  } catch (err) {
    next(err);
  }
});

router.post('/dynamic-respuestas', async (req, res, next) => {
  try {
    const validation = dynamicRespuestaSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(validation.error),
      });
    }

    const { idea_id, dynamic_question_id, respuesta } = validation.data;

    const { data: dq, error: dqError } = await supabase
      .from('dynamic_questions')
      .select('id')
      .eq('id', dynamic_question_id)
      .eq('idea_id', idea_id)
      .maybeSingle();

    if (dqError) {
      return sendDbError(res, dqError, 'POST /dynamic-respuestas (question lookup)');
    }

    if (!dq) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ status: 'error', message: MESSAGES.DYNAMIC_Q_NOT_EXISTS });
    }

    // UNIQUE(idea_id, dynamic_question_id): editing must overwrite, not duplicate.
    const { data, error } = await supabase
      .from('dynamic_respuestas')
      .upsert([{ idea_id, dynamic_question_id, respuesta: respuesta.trim() }], {
        onConflict: 'idea_id,dynamic_question_id',
      })
      .select()
      .single();

    if (error) {
      return sendDbError(res, error, 'POST /dynamic-respuestas');
    }

    res.status(HTTP_STATUS.CREATED).json({ status: 'ok', respuesta: data });
  } catch (err) {
    next(err);
  }
});

router.get('/ideas/:id/dynamic-respuestas', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('dynamic_respuestas')
      .select('*, dynamic_questions!inner(pregunta, orden)')
      .eq('idea_id', req.params.id)
      .order('dynamic_questions(orden)', { ascending: true });

    if (error) {
      return sendDbError(res, error, 'GET /ideas/:id/dynamic-respuestas');
    }

    const dynamic_respuestas = (data || []).map(({ dynamic_questions, ...resp }) => ({
      ...resp,
      pregunta: dynamic_questions?.pregunta,
      orden: dynamic_questions?.orden,
    }));

    res.json({ status: 'ok', dynamic_respuestas });
  } catch (err) {
    next(err);
  }
});

export default router;
