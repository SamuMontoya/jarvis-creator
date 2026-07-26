import express from 'express';
import supabase from '../supabaseClient.js';
import { HTTP_STATUS, MESSAGES } from '../config.js';
import { sendDbError } from '../errorHandler.js';
import { logger } from '../logger.js';

const router = express.Router();

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
};

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => HTML_ENTITIES[c]);

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

const toHtml = (respuestas, emptyLabel) =>
  respuestas.length === 0
    ? `<p style="color:#999;">${emptyLabel}</p>`
    : respuestas
        .map(
          (resp, idx) => `
        <div class="question"><strong>Pregunta ${idx + 1}:</strong> ${escapeHtml(questionText(resp, idx))}</div>
        <div class="answer">${escapeHtml(resp.respuesta)}</div>`
        )
        .join('');

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

function buildHtml({ idea, genRespuestas, dynRespuestas }) {
  return `<!DOCTYPE html>
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
    <p><strong>Creada:</strong> ${idea.created_at ? formatDate(idea.created_at) : 'N/A'}</p>
  </div>

  <h2>Definición (Descubrimiento Inicial)</h2>
  <div>${toHtml(genRespuestas, EMPTY_GENERIC)}</div>

  <h2>Análisis Profundo</h2>
  <div>${toHtml(dynRespuestas, EMPTY_DYNAMIC)}</div>

  <div class="timestamp">Generado el ${formatDate()}</div>
</body>
</html>`;
}

router.post('/ideas/:id/generate-final-html', async (req, res, next) => {
  try {
    const data = await loadOrRespond(req, res);
    if (!data) return;

    const html = buildHtml(data);

    const { error: updateError } = await supabase
      .from('ideas')
      .update({ md_final: html })
      .eq('id', req.params.id);

    // Caching the rendered document is best-effort; the download still works.
    if (updateError) {
      logger.error('Could not persist md_final', updateError);
    }

    res.json({ status: 'ok', html });
  } catch (err) {
    next(err);
  }
});

router.post('/ideas/:id/generate-final-markdown', async (req, res, next) => {
  try {
    const data = await loadOrRespond(req, res);
    if (!data) return;

    res.json({ status: 'ok', markdown: buildMarkdown(data) });
  } catch (err) {
    next(err);
  }
});

// The PDF is rendered client-side from this markdown (jsPDF); the server only
// supplies the source so both downloads stay byte-identical in content.
router.post('/ideas/:id/generate-final-pdf', async (req, res, next) => {
  try {
    const data = await loadOrRespond(req, res);
    if (!data) return;

    res.json({ status: 'ok', markdown: buildMarkdown(data) });
  } catch (err) {
    next(err);
  }
});

export default router;
