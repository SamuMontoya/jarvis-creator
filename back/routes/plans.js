import express from 'express';
import { Groq } from 'groq-sdk';
import supabase from '../supabaseClient.js';
import {
  ideaIdParamSchema,
  planIdParamSchema,
  epicaIdParamSchema,
  updateEpicaSchema,
  storyIdParamSchema,
  updateStorySchema,
  taskIdParamSchema,
  updateTaskSchema,
  subtaskIdParamSchema,
  updateSubtaskSchema,
  firstValidationMessage,
} from '../validators.js';
import { HTTP_STATUS, MESSAGES, GROQ_MODEL, PLAN_FRENTES, PLAN_MAX_TOKENS } from '../config.js';
import { sendDbError } from '../errorHandler.js';
import { logger } from '../logger.js';

const router = express.Router();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT =
  'Eres un experto product manager y arquitecto de software. Descompones ideas de ' +
  'negocio en backlogs de desarrollo completos, accionables y en formato JSON estricto.';

const buildPrompt = (idea, genRespuestas, dynRespuestas) => `Genera un backlog de desarrollo completo para esta idea de negocio.

IDEA: "${idea.texto_idea}"

DESCUBRIMIENTO INICIAL:
${genRespuestas.map((r, i) => `${i + 1}. ${r.generic_questions?.pregunta ?? ''} → ${r.respuesta}`).join('\n')}

ANÁLISIS PROFUNDO:
${dynRespuestas.map((r, i) => `${i + 1}. ${r.dynamic_questions?.pregunta ?? ''} → ${r.respuesta}`).join('\n')}

INSTRUCCIONES:
- Genera de 3 a 5 épicas, ordenadas.
- Por cada épica, genera de 4 a 6 user stories, ordenadas, cada una con sus criterios de aceptación.
- Por cada user story, genera EXACTAMENTE 6 tasks, una por cada frente, EN ESTE ORDEN EXACTO:
  definicion, ux_ui, frontend, backend, testing, devops.
- Por cada task, genera de 2 a 3 subtasks. Cada subtask debe ser ejecutable en 30 minutos o
  menos, hiper específica y accionable.
- Todo el contenido debe estar en español.
- El backlog debe ser LINEAL: sin dependencias paralelas entre épicas, stories o tasks.
- Responde SOLO JSON válido, sin markdown ni explicación, con esta forma exacta:
{
  "epicas": [
    {
      "titulo": "...",
      "descripcion": "...",
      "orden": 1,
      "user_stories": [
        {
          "titulo": "...",
          "descripcion": "...",
          "criterios_aceptacion": "...",
          "orden": 1,
          "tasks": [
            {
              "titulo": "...",
              "descripcion": "...",
              "frente": "definicion",
              "orden": 1,
              "subtasks": [
                {"titulo": "...", "descripcion": "...", "tiempo_estimado_min": 20, "orden": 1}
              ]
            }
          ]
        }
      ]
    }
  ]
}`;

async function askGroqForPlan(idea, genRespuestas, dynRespuestas) {
  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(idea, genRespuestas, dynRespuestas) },
    ],
    model: GROQ_MODEL,
    temperature: 0.3,
    max_tokens: PLAN_MAX_TOKENS,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Groq devolvió una respuesta vacía al generar el plan de trabajo');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (parseError) {
    throw new Error(`No se pudo parsear el JSON del plan generado por Groq: ${parseError.message}`);
  }

  if (!Array.isArray(parsed.epicas) || parsed.epicas.length === 0) {
    throw new Error('El plan generado por Groq no tiene el formato esperado (falta "epicas")');
  }

  return parsed;
}

const byOrden = (a, b) => (a.orden ?? 0) - (b.orden ?? 0);

async function insertRow(table, row) {
  const { data, error } = await supabase.from(table).insert([row]).select().single();
  if (error) throw error;
  return data;
}

async function insertPlanCascade(planId, epicas) {
  const counts = { epicas_count: 0, stories_count: 0, tasks_count: 0, subtasks_count: 0 };

  for (const epica of [...epicas].sort(byOrden)) {
    const epicaRow = await insertRow('epicas', {
      plan_id: planId,
      titulo: epica.titulo,
      descripcion: epica.descripcion,
      orden: epica.orden,
    });
    counts.epicas_count += 1;

    for (const story of [...(epica.user_stories || [])].sort(byOrden)) {
      const storyRow = await insertRow('user_stories', {
        epica_id: epicaRow.id,
        titulo: story.titulo,
        descripcion: story.descripcion,
        criterios_aceptacion: story.criterios_aceptacion,
        orden: story.orden,
      });
      counts.stories_count += 1;

      const tasks = [...(story.tasks || [])].sort(
        (a, b) => PLAN_FRENTES.indexOf(a.frente) - PLAN_FRENTES.indexOf(b.frente)
      );

      for (const task of tasks) {
        const taskRow = await insertRow('tasks', {
          user_story_id: storyRow.id,
          titulo: task.titulo,
          descripcion: task.descripcion,
          frente: task.frente,
          orden: task.orden,
        });
        counts.tasks_count += 1;

        for (const subtask of [...(task.subtasks || [])].sort(byOrden)) {
          await insertRow('subtasks', {
            task_id: taskRow.id,
            titulo: subtask.titulo,
            descripcion: subtask.descripcion,
            tiempo_estimado_min: subtask.tiempo_estimado_min,
            orden: subtask.orden,
          });
          counts.subtasks_count += 1;
        }
      }
    }
  }

  return counts;
}

router.post('/ideas/:id/generate-plan', async (req, res, next) => {
  try {
    const paramsValidation = ideaIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(paramsValidation.error),
      });
    }

    const { id } = paramsValidation.data;

    // Generation is expensive and non-deterministic: reuse what's already stored.
    const { data: existingPlan, error: existingError } = await supabase
      .from('work_plans')
      .select('id')
      .eq('idea_id', id)
      .maybeSingle();

    if (existingError) {
      return sendDbError(res, existingError, 'generate-plan (existing lookup)');
    }

    if (existingPlan) {
      return res.json({ status: 'ok', plan_id: existingPlan.id, already_exists: true });
    }

    const { data: idea, error: ideaError } = await supabase
      .from('ideas')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (ideaError) {
      return sendDbError(res, ideaError, 'generate-plan (idea lookup)');
    }

    if (!idea) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ status: 'error', message: MESSAGES.IDEA_NOT_FOUND });
    }

    const { data: genRespuestas, error: genRError } = await supabase
      .from('respuestas')
      .select('*, generic_questions(pregunta, orden)')
      .eq('idea_id', id)
      .order('created_at', { ascending: true });

    if (genRError) {
      return sendDbError(res, genRError, 'generate-plan (respuestas)');
    }

    const { data: dynRespuestas, error: dynRError } = await supabase
      .from('dynamic_respuestas')
      .select('*, dynamic_questions!inner(pregunta, orden)')
      .eq('idea_id', id)
      .order('dynamic_questions(orden)', { ascending: true });

    if (dynRError) {
      return sendDbError(res, dynRError, 'generate-plan (dynamic_respuestas)');
    }

    let plan;
    try {
      plan = await askGroqForPlan(idea, genRespuestas || [], dynRespuestas || []);
    } catch (groqError) {
      logger.error('Groq plan generation failed', groqError);
      return res
        .status(HTTP_STATUS.SERVER_ERROR)
        .json({ status: 'error', message: MESSAGES.PLAN_GROQ_ERROR });
    }

    const workPlan = await insertRow('work_plans', { idea_id: id });
    const counts = await insertPlanCascade(workPlan.id, plan.epicas);

    logger.info('Plan de trabajo generado', { idea_id: id, plan_id: workPlan.id, ...counts });

    res.status(HTTP_STATUS.CREATED).json({ status: 'ok', plan_id: workPlan.id, ...counts });
  } catch (err) {
    logger.error('POST /ideas/:id/generate-plan failed', err);
    next(err);
  }
});

router.get('/plans/:plan_id/epicas', async (req, res, next) => {
  try {
    const paramsValidation = planIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(paramsValidation.error),
      });
    }

    const { data, error } = await supabase
      .from('epicas')
      .select('*')
      .eq('plan_id', paramsValidation.data.plan_id)
      .order('orden', { ascending: true });

    if (error) {
      return sendDbError(res, error, 'GET /plans/:plan_id/epicas');
    }

    res.json({ status: 'ok', epicas: data || [] });
  } catch (err) {
    next(err);
  }
});

router.get('/epicas/:epica_id', async (req, res, next) => {
  try {
    const paramsValidation = epicaIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(paramsValidation.error),
      });
    }

    const { data, error } = await supabase
      .from('epicas')
      .select('*')
      .eq('id', paramsValidation.data.epica_id)
      .maybeSingle();

    if (error) {
      return sendDbError(res, error, 'GET /epicas/:epica_id');
    }

    if (!data) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ status: 'error', message: MESSAGES.EPICA_NOT_FOUND });
    }

    res.json({ status: 'ok', epica: data });
  } catch (err) {
    next(err);
  }
});

router.patch('/epicas/:epica_id', async (req, res, next) => {
  try {
    const paramsValidation = epicaIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(paramsValidation.error),
      });
    }

    const bodyValidation = updateEpicaSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(bodyValidation.error),
      });
    }

    const updates = Object.fromEntries(
      Object.entries(bodyValidation.data).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(updates).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: MESSAGES.INVALID_INPUT,
      });
    }

    const { data, error } = await supabase
      .from('epicas')
      .update(updates)
      .eq('id', paramsValidation.data.epica_id)
      .select()
      .maybeSingle();

    if (error) {
      return sendDbError(res, error, 'PATCH /epicas/:epica_id');
    }

    if (!data) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ status: 'error', message: MESSAGES.EPICA_NOT_FOUND });
    }

    res.json({ status: 'ok', epica: data });
  } catch (err) {
    next(err);
  }
});

router.get('/epicas/:epica_id/stories', async (req, res, next) => {
  try {
    const paramsValidation = epicaIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(paramsValidation.error),
      });
    }

    const { data, error } = await supabase
      .from('user_stories')
      .select('*')
      .eq('epica_id', paramsValidation.data.epica_id)
      .order('orden', { ascending: true });

    if (error) {
      return sendDbError(res, error, 'GET /epicas/:epica_id/stories');
    }

    res.json({ status: 'ok', stories: data || [] });
  } catch (err) {
    next(err);
  }
});

router.get('/stories/:story_id', async (req, res, next) => {
  try {
    const paramsValidation = storyIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(paramsValidation.error),
      });
    }

    const { data, error } = await supabase
      .from('user_stories')
      .select('*')
      .eq('id', paramsValidation.data.story_id)
      .maybeSingle();

    if (error) {
      return sendDbError(res, error, 'GET /stories/:story_id');
    }

    if (!data) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ status: 'error', message: MESSAGES.STORY_NOT_FOUND });
    }

    res.json({ status: 'ok', story: data });
  } catch (err) {
    next(err);
  }
});

router.patch('/stories/:story_id', async (req, res, next) => {
  try {
    const paramsValidation = storyIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(paramsValidation.error),
      });
    }

    const bodyValidation = updateStorySchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(bodyValidation.error),
      });
    }

    const updates = Object.fromEntries(
      Object.entries(bodyValidation.data).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(updates).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: MESSAGES.INVALID_INPUT,
      });
    }

    const { data, error } = await supabase
      .from('user_stories')
      .update(updates)
      .eq('id', paramsValidation.data.story_id)
      .select()
      .maybeSingle();

    if (error) {
      return sendDbError(res, error, 'PATCH /stories/:story_id');
    }

    if (!data) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ status: 'error', message: MESSAGES.STORY_NOT_FOUND });
    }

    res.json({ status: 'ok', story: data });
  } catch (err) {
    next(err);
  }
});

router.get('/stories/:story_id/tasks', async (req, res, next) => {
  try {
    const paramsValidation = storyIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(paramsValidation.error),
      });
    }

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_story_id', paramsValidation.data.story_id)
      .order('orden', { ascending: true });

    if (error) {
      return sendDbError(res, error, 'GET /stories/:story_id/tasks');
    }

    res.json({ status: 'ok', tasks: data || [] });
  } catch (err) {
    next(err);
  }
});

router.get('/tasks/:task_id', async (req, res, next) => {
  try {
    const paramsValidation = taskIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(paramsValidation.error),
      });
    }

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', paramsValidation.data.task_id)
      .maybeSingle();

    if (error) {
      return sendDbError(res, error, 'GET /tasks/:task_id');
    }

    if (!data) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ status: 'error', message: MESSAGES.TASK_NOT_FOUND });
    }

    res.json({ status: 'ok', task: data });
  } catch (err) {
    next(err);
  }
});

router.patch('/tasks/:task_id', async (req, res, next) => {
  try {
    const paramsValidation = taskIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(paramsValidation.error),
      });
    }

    const bodyValidation = updateTaskSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(bodyValidation.error),
      });
    }

    const updates = Object.fromEntries(
      Object.entries(bodyValidation.data).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(updates).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: MESSAGES.INVALID_INPUT,
      });
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', paramsValidation.data.task_id)
      .select()
      .maybeSingle();

    if (error) {
      return sendDbError(res, error, 'PATCH /tasks/:task_id');
    }

    if (!data) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ status: 'error', message: MESSAGES.TASK_NOT_FOUND });
    }

    res.json({ status: 'ok', task: data });
  } catch (err) {
    next(err);
  }
});

router.get('/tasks/:task_id/subtasks', async (req, res, next) => {
  try {
    const paramsValidation = taskIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(paramsValidation.error),
      });
    }

    const { data, error } = await supabase
      .from('subtasks')
      .select('*')
      .eq('task_id', paramsValidation.data.task_id)
      .order('orden', { ascending: true });

    if (error) {
      return sendDbError(res, error, 'GET /tasks/:task_id/subtasks');
    }

    res.json({ status: 'ok', subtasks: data || [] });
  } catch (err) {
    next(err);
  }
});

router.get('/subtasks/:subtask_id', async (req, res, next) => {
  try {
    const paramsValidation = subtaskIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(paramsValidation.error),
      });
    }

    const { data, error } = await supabase
      .from('subtasks')
      .select('*')
      .eq('id', paramsValidation.data.subtask_id)
      .maybeSingle();

    if (error) {
      return sendDbError(res, error, 'GET /subtasks/:subtask_id');
    }

    if (!data) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ status: 'error', message: MESSAGES.SUBTASK_NOT_FOUND });
    }

    res.json({ status: 'ok', subtask: data });
  } catch (err) {
    next(err);
  }
});

router.patch('/subtasks/:subtask_id', async (req, res, next) => {
  try {
    const paramsValidation = subtaskIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(paramsValidation.error),
      });
    }

    const bodyValidation = updateSubtaskSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(bodyValidation.error),
      });
    }

    const updates = Object.fromEntries(
      Object.entries(bodyValidation.data).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(updates).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: MESSAGES.INVALID_INPUT,
      });
    }

    const { data, error } = await supabase
      .from('subtasks')
      .update(updates)
      .eq('id', paramsValidation.data.subtask_id)
      .select()
      .maybeSingle();

    if (error) {
      return sendDbError(res, error, 'PATCH /subtasks/:subtask_id');
    }

    if (!data) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ status: 'error', message: MESSAGES.SUBTASK_NOT_FOUND });
    }

    res.json({ status: 'ok', subtask: data });
  } catch (err) {
    next(err);
  }
});

export default router;
