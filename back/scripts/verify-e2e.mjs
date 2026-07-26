#!/usr/bin/env node
/**
 * Recorre el flujo completo contra el backend y la base REALES.
 * No usa mocks: es la verificación que los tests unitarios no pueden dar.
 *
 *   node scripts/verify-e2e.mjs
 *
 * Levanta el servidor en un puerto efímero, ejecuta los 14 pasos del flujo y
 * limpia lo que creó. Sale con código 1 si algo falla.
 */
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[36m·\x1b[0m';

const results = [];
let base;
let ideaId;

const step = async (name, fn) => {
  const started = Date.now();
  try {
    const detail = await fn();
    const ms = Date.now() - started;
    results.push({ name, ok: true });
    console.log(`${PASS} ${name}${detail ? ` — ${detail}` : ''} \x1b[90m(${ms} ms)\x1b[0m`);
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
    console.log(`${FAIL} ${name}\n    \x1b[31m${err.message}\x1b[0m`);
  }
};

const api = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} -> HTTP ${res.status}: ${data.message ?? '(sin mensaje)'}`);
  }
  return data;
};

const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

async function main() {
  console.log('\n\x1b[1mVerificación E2E contra Supabase real\x1b[0m');
  console.log(`${INFO} proyecto: ${process.env.SUPABASE_URL}\n`);

  const { default: app } = await import('../app.js');
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://localhost:${server.address().port}/api`;

  let questions = [];
  let dynamicQuestions = [];

  await step('a. POST /api/ideas — crear idea', async () => {
    const { idea } = await api('/ideas', {
      method: 'POST',
      body: { texto_idea: 'Verificación E2E automatizada de JARVIS Creator' },
    });
    assert(idea?.id, 'no devolvió idea.id');
    assert(idea.estado === 'draft', `estado inicial esperado draft, fue ${idea.estado}`);
    ideaId = idea.id;
    return `id ${idea.id.slice(0, 8)}`;
  });

  await step('b. GET /api/questions — 5 preguntas genéricas', async () => {
    const { questions: qs } = await api('/questions');
    assert(qs.length === 5, `esperaba 5 preguntas, hay ${qs.length}`);
    assert(
      qs.every((q, i) => q.orden === i + 1),
      'las preguntas no vienen ordenadas por orden'
    );
    questions = qs;
    return `${qs.length} preguntas`;
  });

  await step('c. POST /api/respuestas ×5', async () => {
    assert(questions.length === 5, `sin preguntas que responder (${questions.length}); paso previo falló`);
    for (const [i, q] of questions.entries()) {
      await api('/respuestas', {
        method: 'POST',
        body: {
          idea_id: ideaId,
          generic_question_id: q.id,
          respuesta: `Respuesta E2E número ${i + 1} con detalle suficiente.`,
        },
      });
    }
    return '5 guardadas';
  });

  await step('c2. POST /api/respuestas — reenviar hace upsert, no duplica', async () => {
    await api('/respuestas', {
      method: 'POST',
      body: {
        idea_id: ideaId,
        generic_question_id: questions[0].id,
        respuesta: 'Respuesta E2E número 1 EDITADA.',
      },
    });
    const { respuestas } = await api(`/ideas/${ideaId}/respuestas`);
    assert(respuestas.length === 5, `tras editar hay ${respuestas.length} respuestas, esperaba 5`);
    const edited = respuestas.find((r) => r.generic_question_id === questions[0].id);
    assert(/EDITADA/.test(edited.respuesta), 'la edición no se persistió');
    return 'sin duplicados';
  });

  await step('d. GET /api/ideas/:id/respuestas', async () => {
    const { respuestas } = await api(`/ideas/${ideaId}/respuestas`);
    assert(respuestas.length === 5, `esperaba 5, hay ${respuestas.length}`);
    assert(respuestas[0].generic_questions?.pregunta, 'no hace join con generic_questions');
    return '5 con join';
  });

  await step('e. POST /generate-dynamic-questions — Groq real', async () => {
    const { dynamic_questions } = await api(`/ideas/${ideaId}/generate-dynamic-questions`, {
      method: 'POST',
    });
    assert(dynamic_questions.length === 10, `Groq devolvió ${dynamic_questions.length}, esperaba 10`);
    assert(
      dynamic_questions.every((q) => q.pregunta?.length > 15),
      'alguna pregunta vino vacía o demasiado corta'
    );
    dynamicQuestions = dynamic_questions;
    return `10 preguntas · ej: "${dynamic_questions[0].pregunta.slice(0, 55)}..."`;
  });

  await step('e2. Regenerar reutiliza, no vuelve a llamar a Groq', async () => {
    const started = Date.now();
    const { dynamic_questions } = await api(`/ideas/${ideaId}/generate-dynamic-questions`, {
      method: 'POST',
    });
    const ms = Date.now() - started;
    assert(dynamic_questions.length === 10, 'cambió la cantidad al reutilizar');
    assert(dynamic_questions[0].id === dynamicQuestions[0].id, 'regeneró en vez de reutilizar');
    assert(ms < 1500, `tardó ${ms} ms; parece que volvió a llamar a Groq`);
    return `reutilizó en ${ms} ms`;
  });

  await step('f. GET /api/ideas/:id/dynamic-questions', async () => {
    const { dynamic_questions } = await api(`/ideas/${ideaId}/dynamic-questions`);
    assert(dynamic_questions.length === 10, `esperaba 10, hay ${dynamic_questions.length}`);
    assert(
      dynamic_questions.every((q, i) => q.orden === i + 1),
      'no vienen ordenadas'
    );
    return 'ordenadas 1-10';
  });

  await step('g. POST /api/dynamic-respuestas ×10', async () => {
    assert(dynamicQuestions.length === 10, `sin preguntas dinámicas (${dynamicQuestions.length}); paso previo falló`);
    for (const [i, q] of dynamicQuestions.entries()) {
      await api('/dynamic-respuestas', {
        method: 'POST',
        body: {
          idea_id: ideaId,
          dynamic_question_id: q.id,
          respuesta: `Respuesta profunda E2E ${i + 1} con detalle suficiente.`,
        },
      });
    }
    return '10 guardadas';
  });

  await step('h. GET /api/ideas/:id/dynamic-respuestas', async () => {
    const { dynamic_respuestas } = await api(`/ideas/${ideaId}/dynamic-respuestas`);
    assert(dynamic_respuestas.length === 10, `esperaba 10, hay ${dynamic_respuestas.length}`);
    assert(dynamic_respuestas[0].pregunta, 'no aplana la pregunta al nivel superior');
    assert(
      dynamic_respuestas[0].dynamic_questions === undefined,
      'deja el objeto anidado sin limpiar'
    );
    return '10 aplanadas';
  });

  await step('i. POST /generate-final-markdown — contenido real', async () => {
    const { markdown } = await api(`/ideas/${ideaId}/generate-final-markdown`, { method: 'POST' });
    assert(markdown.includes('Verificación E2E'), 'falta el texto de la idea');
    assert(markdown.includes('Definición (Descubrimiento Inicial)'), 'falta la sección genérica');
    assert(markdown.includes('Análisis Profundo'), 'falta la sección dinámica');
    assert(markdown.includes('EDITADA'), 'no refleja la respuesta editada');
    assert(!markdown.includes('No hay respuestas'), 'alguna sección salió vacía');
    return `${markdown.length} caracteres`;
  });

  await step('j. POST /generate-final-pdf — fuente del PDF', async () => {
    const { markdown } = await api(`/ideas/${ideaId}/generate-final-pdf`, { method: 'POST' });
    assert(markdown?.length > 500, 'markdown demasiado corto');
    return `${markdown.length} caracteres`;
  });

  await step('k. POST /generate-final-html — escapa contenido', async () => {
    const { html } = await api(`/ideas/${ideaId}/generate-final-html`, { method: 'POST' });
    assert(html.startsWith('<!DOCTYPE html>'), 'no es un documento HTML');
    assert(html.includes('Verificación E2E'), 'falta el texto de la idea');
    const { idea } = await api(`/ideas/${ideaId}`);
    assert(idea.md_final, 'no persistió md_final');
    return `${html.length} caracteres · md_final guardado`;
  });

  await step('l. PATCH /api/ideas/:id — estado a refined', async () => {
    const { idea } = await api(`/ideas/${ideaId}`, { method: 'PATCH', body: { estado: 'refined' } });
    assert(idea.estado === 'refined', `estado quedó en ${idea.estado}`);
    assert(
      idea.updated_at !== idea.created_at,
      'el trigger de updated_at no disparó (el orden del listado no funcionará)'
    );
    return 'refined · trigger updated_at OK';
  });

  await step('m. GET /api/ideas — orden por updated_at DESC', async () => {
    const { ideas } = await api('/ideas');
    assert(ideas.length > 0, 'listado vacío');
    assert(ideas[0].id === ideaId, 'la idea recién tocada no quedó primera');
    const fechas = ideas.map((i) => new Date(i.updated_at).getTime());
    assert(
      fechas.every((f, i) => i === 0 || fechas[i - 1] >= f),
      'el listado no viene ordenado descendente'
    );
    return `${ideas.length} ideas, la nuestra primera`;
  });

  await step('n. DELETE /api/ideas/:id — cascade real', async () => {
    await api(`/ideas/${ideaId}`, { method: 'DELETE' });

    const res = await fetch(`${base}/ideas/${ideaId}`);
    assert(res.status === 404, `la idea sigue existiendo (HTTP ${res.status})`);

    // Comprobación directa: las hijas deben haber desaparecido por ON DELETE CASCADE.
    const { default: supabase } = await import('../supabaseClient.js');
    for (const table of ['respuestas', 'dynamic_questions', 'dynamic_respuestas']) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('idea_id', ideaId);
      assert(!error, `no se pudo consultar ${table}: ${error?.message}`);
      assert(count === 0, `quedaron ${count} filas huérfanas en ${table}`);
    }
    ideaId = null;
    return 'idea + 3 tablas hijas borradas';
  });

  await step('o. Validaciones rechazan entrada inválida', async () => {
    const cases = [
      ['POST /ideas con idea corta', '/ideas', 'POST', { texto_idea: 'corta' }, 400],
      ['PATCH con estado inválido', `/ideas/${'0'.repeat(8)}-0000-4000-8000-000000000000`, 'PATCH', { estado: 'x' }, 400],
      ['POST /respuestas con uuid inválido', '/respuestas', 'POST', { idea_id: 'x', generic_question_id: 'y', respuesta: 'hola mundo' }, 400],
    ];
    for (const [label, path, method, body, expected] of cases) {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert(res.status === expected, `${label}: esperaba ${expected}, fue ${res.status}`);
      const data = await res.json();
      assert(data.message && !/stack|Error:/i.test(data.message), `${label}: mensaje poco amigable`);
    }
    return `${cases.length} casos`;
  });

  // Limpieza si algo falló a mitad y dejó la idea creada.
  if (ideaId) {
    await fetch(`${base}/ideas/${ideaId}`, { method: 'DELETE' }).catch(() => {});
    console.log(`${INFO} idea de prueba eliminada tras el fallo`);
  }

  server.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n\x1b[1m${results.length - failed.length}/${results.length} pasos OK\x1b[0m`);
  if (failed.length) {
    console.log(`\n\x1b[31mFallaron:\x1b[0m`);
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.error}`));
    process.exit(1);
  }
  console.log('\x1b[32mFlujo E2E completo verificado contra la base real.\x1b[0m\n');
}

main().catch((err) => {
  console.error(`\n${FAIL} La verificación se detuvo:\n${err.stack}\n`);
  process.exit(1);
});
