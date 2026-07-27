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
import { formatGroqError } from '../groqErrors.js';

const router = express.Router();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT =
  'Eres un experto product manager y arquitecto de software senior. Descompones ideas de ' +
  'negocio en backlogs de desarrollo completos, accionables y en formato JSON estricto. ' +
  'Cada task y subtask debe ser concreta, ejecutable en ≤30 min, y contener detalles ' +
  'técnicos específicos (nombres de tablas, endpoints, queries, comandos, archivos).';

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
  menos, HIPER ESPECÍFICA Y ACCIONABLE.

REGLAS DE ESPECIFICIDAD PARA SUBTASKS (OBLIGATORIO):
- NO uses frases genéricas como "Implementar X", "Crear componente Y", "Configurar Z".
- SÍ incluye: nombres exactos de archivos, endpoints HTTP (METHOD /path), queries SQL (CREATE TABLE, ALTER, INDEX), comandos CLI, variables de entorno, nombres de componentes React, hooks, servicios, tipos TypeScript, middlewares, pipelines CI/CD.
- Ejemplos de subtasks BIEN hechas:
  * "Crear migración SQL: CREATE TABLE usuarios (id UUID PRIMARY KEY, email VARCHAR UNIQUE, password_hash TEXT, creado_en TIMESTAMPTZ DEFAULT NOW())"
  * "Añadir endpoint POST /api/auth/login en backend/routes/auth.js: validar body con zod, llamar a authService.login(email, password), devolver { token, user }"
  * "Crear componente React src/components/LoginForm.tsx: formulario con email/password, usar react-hook-form, llamar a useAuth().login(), manejar errores 401"
  * "Configurar GitHub Actions .github/workflows/ci.yml: job test con npm test, job build con npm run build, trigger en push a main"
  * "Añadir variable de entorno JWT_SECRET en .env.example y documentar en README.md sección 'Configuración'"
  * "Escribir test de integración tests/auth.test.js: POST /api/auth/login con credenciales válidas → 200 + token JWT"
  * "Crear hook personalizado src/hooks/useAuth.ts: estado user/token en localStorage, funciones login/logout, tipado TypeScript"
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
    const force = req.query.force === 'true';

    // Generation is expensive and non-deterministic: without force, reuse the
    // most recent version already stored. With force, a NEW version is
    // created and the previous ones are kept as history (never deleted).
    if (!force) {
      const { data: existingPlan, error: existingError } = await supabase
        .from('work_plans')
        .select('id')
        .eq('idea_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) {
        return sendDbError(res, existingError, 'generate-plan (existing lookup)');
      }

      if (existingPlan) {
        return res.json({ status: 'ok', plan_id: existingPlan.id, already_exists: true });
      }
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
      return res.status(HTTP_STATUS.SERVER_ERROR).json({
        status: 'error',
        message: formatGroqError(groqError, MESSAGES.PLAN_GROQ_ERROR),
      });
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

router.get('/ideas/:id/plan', async (req, res, next) => {
  try {
    const paramsValidation = ideaIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(paramsValidation.error),
      });
    }

    const { id } = paramsValidation.data;

    // "The" plan for an idea is its most recent version — older versions
    // stay reachable through GET /ideas/:id/plans.
    const { data: existingPlan, error: existingError } = await supabase
      .from('work_plans')
      .select('id')
      .eq('idea_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return sendDbError(res, existingError, 'get-plan-for-idea');
    }

    if (!existingPlan) {
      return res.json({ status: 'ok', plan_id: null });
    }

    res.json({ status: 'ok', plan_id: existingPlan.id });
  } catch (err) {
    logger.error('GET /ideas/:id/plan failed', err);
    next(err);
  }
});

router.get('/plans', async (req, res, next) => {
  try {
    const { data: plans, error: plansError } = await supabase
      .from('work_plans')
      .select('id, idea_id, created_at, ideas(titulo, texto_idea)')
      .order('created_at', { ascending: false });

    if (plansError) {
      return sendDbError(res, plansError, 'GET /plans');
    }

    const planIds = (plans || []).map((p) => p.id);
    let epicasCountByPlan = {};

    if (planIds.length > 0) {
      const { data: epicasRows, error: epicasError } = await supabase
        .from('epicas')
        .select('id, plan_id')
        .in('plan_id', planIds);

      if (epicasError) {
        return sendDbError(res, epicasError, 'GET /plans (epicas count)');
      }

      epicasCountByPlan = (epicasRows || []).reduce((acc, row) => {
        acc[row.plan_id] = (acc[row.plan_id] || 0) + 1;
        return acc;
      }, {});
    }

    res.json({
      status: 'ok',
      plans: (plans || []).map((plan) => ({
        id: plan.id,
        idea_id: plan.idea_id,
        created_at: plan.created_at,
        idea_titulo: plan.ideas?.titulo ?? null,
        idea_texto: plan.ideas?.texto_idea ?? null,
        epicas_count: epicasCountByPlan[plan.id] || 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/ideas/:id/plans', async (req, res, next) => {
  try {
    const paramsValidation = ideaIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(paramsValidation.error),
      });
    }

    const { id } = paramsValidation.data;

    const { data: plans, error: plansError } = await supabase
      .from('work_plans')
      .select('id, created_at')
      .eq('idea_id', id)
      .order('created_at', { ascending: false });

    if (plansError) {
      return sendDbError(res, plansError, 'GET /ideas/:id/plans');
    }

    const planIds = (plans || []).map((p) => p.id);
    let epicasCountByPlan = {};

    if (planIds.length > 0) {
      const { data: epicasRows, error: epicasError } = await supabase
        .from('epicas')
        .select('id, plan_id')
        .in('plan_id', planIds);

      if (epicasError) {
        return sendDbError(res, epicasError, 'GET /ideas/:id/plans (epicas count)');
      }

      epicasCountByPlan = (epicasRows || []).reduce((acc, row) => {
        acc[row.plan_id] = (acc[row.plan_id] || 0) + 1;
        return acc;
      }, {});
    }

    res.json({
      status: 'ok',
      plans: (plans || []).map((plan) => ({
        ...plan,
        epicas_count: epicasCountByPlan[plan.id] || 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/plans/:plan_id/full', async (req, res, next) => {
  try {
    const paramsValidation = planIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(paramsValidation.error),
      });
    }

    const { plan_id: planId } = paramsValidation.data;

    // One batched round trip per tree level instead of the old
    // fetch-per-node waterfall (epica -> stories -> tasks -> subtasks, N+1
    // all the way down): 4 queries total, however large the plan is.
    const { data: epicas, error: epicasError } = await supabase
      .from('epicas')
      .select('*')
      .eq('plan_id', planId)
      .order('orden', { ascending: true });

    if (epicasError) {
      return sendDbError(res, epicasError, 'GET /plans/:plan_id/full (epicas)');
    }

    const epicaIds = (epicas || []).map((e) => e.id);
    const { data: stories, error: storiesError } = epicaIds.length
      ? await supabase
          .from('user_stories')
          .select('*')
          .in('epica_id', epicaIds)
          .order('orden', { ascending: true })
      : { data: [], error: null };

    if (storiesError) {
      return sendDbError(res, storiesError, 'GET /plans/:plan_id/full (stories)');
    }

    const storyIds = (stories || []).map((s) => s.id);
    const { data: tasks, error: tasksError } = storyIds.length
      ? await supabase
          .from('tasks')
          .select('*')
          .in('user_story_id', storyIds)
          .order('orden', { ascending: true })
      : { data: [], error: null };

    if (tasksError) {
      return sendDbError(res, tasksError, 'GET /plans/:plan_id/full (tasks)');
    }

    const taskIds = (tasks || []).map((t) => t.id);
    const { data: subtasks, error: subtasksError } = taskIds.length
      ? await supabase
          .from('subtasks')
          .select('*')
          .in('task_id', taskIds)
          .order('orden', { ascending: true })
      : { data: [], error: null };

    if (subtasksError) {
      return sendDbError(res, subtasksError, 'GET /plans/:plan_id/full (subtasks)');
    }

    const groupBy = (rows, key) =>
      (rows || []).reduce((acc, row) => {
        (acc[row[key]] ||= []).push(row);
        return acc;
      }, {});

    const subtasksByTask = groupBy(subtasks, 'task_id');
    const tasksByStory = groupBy(
      (tasks || []).map((task) => ({ ...task, subtasks: subtasksByTask[task.id] || [] })),
      'user_story_id'
    );
    const storiesByEpica = groupBy(
      (stories || []).map((story) => ({ ...story, tasks: tasksByStory[story.id] || [] })),
      'epica_id'
    );
    const tree = (epicas || []).map((epica) => ({
      ...epica,
      stories: storiesByEpica[epica.id] || [],
    }));

    res.json({ status: 'ok', epicas: tree });
  } catch (err) {
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
