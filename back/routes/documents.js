import express from 'express';
import supabase from '../supabaseClient.js';
import { HTTP_STATUS, MESSAGES } from '../config.js';
import { sendDbError } from '../errorHandler.js';

const router = express.Router();

const escapeMd = (str) => String(str ?? '').replace(/([\\*_#`[\]])/g, '\\$1');

const formatDate = (value = new Date()) =>
  new Date(value).toLocaleString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

async function fetchIdeaData(id) {
  const { data: idea, error: ideaError } = await supabase
    .from('ideas')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (ideaError) return { dbError: ideaError, context: 'documents (idea lookup)' };
  if (!idea) return { notFound: true };

  const { data: genRespuestas, error: genRError } = await supabase
    .from('respuestas')
    .select('*, generic_questions(pregunta, orden)')
    .eq('idea_id', id)
    .order('created_at', { ascending: true });

  if (genRError) return { dbError: genRError, context: 'documents (respuestas)' };

  const { data: dynRespuestas, error: dynRError } = await supabase
    .from('dynamic_respuestas')
    .select('*, dynamic_questions!inner(pregunta, orden)')
    .eq('idea_id', id)
    .order('dynamic_questions(orden)', { ascending: true });

  if (dynRError) return { dbError: dynRError, context: 'documents (dynamic_respuestas)' };

  return { idea, genRespuestas: genRespuestas || [], dynRespuestas: dynRespuestas || [] };
}

// Resolves the loaded idea or finishes the response with the right error.
async function loadOrRespond(req, res) {
  const result = await fetchIdeaData(req.params.id);

  if (result.dbError) {
    sendDbError(res, result.dbError, result.context);
    return null;
  }

  if (result.notFound) {
    res.status(HTTP_STATUS.NOT_FOUND).json({ status: 'error', message: MESSAGES.IDEA_NOT_FOUND });
    return null;
  }

  return result;
}

const questionText = (resp, idx) =>
  resp.generic_questions?.pregunta || resp.dynamic_questions?.pregunta || resp.pregunta ||
  `Pregunta ${idx + 1}`;

const toMarkdown = (respuestas, emptyLabel) =>
  respuestas.length === 0
    ? `*${emptyLabel}*`
    : respuestas
        .map(
          (resp, idx) =>
            `### Pregunta ${idx + 1}: ${escapeMd(questionText(resp, idx))}\n\n${escapeMd(resp.respuesta)}\n`
        )
        .join('\n');

const EMPTY_GENERIC = 'No hay respuestas del descubrimiento inicial registradas';
const EMPTY_DYNAMIC = 'No hay respuestas del análisis profundo registradas';

function buildMarkdown({ idea, genRespuestas, dynRespuestas }) {
  return `# ${escapeMd(idea.texto_idea)}

## Información
- **Estado:** ${escapeMd(idea.estado || 'draft')}
- **Creada:** ${idea.created_at ? formatDate(idea.created_at) : 'N/A'}
- **Generado:** ${formatDate()}

---

## Definición (Descubrimiento Inicial)

${toMarkdown(genRespuestas, EMPTY_GENERIC)}

---

## Análisis Profundo

${toMarkdown(dynRespuestas, EMPTY_DYNAMIC)}

---

*Generado por JARVIS Creator el ${formatDate()}*`;
}

router.post('/ideas/:id/generate-final-markdown', async (req, res, next) => {
  try {
    const data = await loadOrRespond(req, res);
    if (!data) return;

    res.json({ status: 'ok', markdown: buildMarkdown(data) });
  } catch (err) {
    next(err);
  }
});

export default router;
