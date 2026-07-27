import { describe, test, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createSupabaseMock, chainHelpers } from './supabaseMock.js';
import { PLAN_FRENTES } from '../config.js';

const { values, filters } = chainHelpers;

const mockState = { handlers: {}, calls: [] };
const groqCreate = vi.fn();

vi.mock('../supabaseClient.js', () => ({
  default: {
    from: (table) => {
      const { client, calls } = createSupabaseMock(mockState.handlers);
      const builder = client.from(table);
      // Surface this query's chain on the shared call log once awaited.
      const originalThen = builder.then.bind(builder);
      builder.then = (onFulfilled, onRejected) => {
        const result = originalThen(onFulfilled, onRejected);
        mockState.calls.push(...calls);
        return result;
      };
      return builder;
    },
  },
}));

vi.mock('groq-sdk', () => ({
  Groq: class {
    constructor() {
      this.chat = { completions: { create: groqCreate } };
    }
  },
}));

const { default: app } = await import('../app.js');

const IDEA_ID = '11111111-1111-4111-8111-111111111111';
const PLAN_ID = '22222222-2222-4222-8222-222222222222';
const EPICA_ID = '33333333-3333-4333-8333-333333333333';
const STORY_ID = '44444444-4444-4444-8444-444444444444';
const SUBTASK_ID = '55555555-5555-4555-8555-555555555555';

const idea = { id: IDEA_ID, texto_idea: 'Una app para pasear perros', estado: 'draft' };

const mockTables = (handlers) => {
  mockState.handlers = handlers;
};

const lastCall = (table) => mockState.calls.filter((c) => c.table === table).at(-1);

const insertedRows = (table) =>
  mockState.calls.filter((c) => c.table === table).map((c) => values(c)[0]);

const usedOp = (chain, name) => chain.ops.some((op) => op.name === name);

const groupBy = (rows, key) =>
  rows.reduce((acc, row) => {
    (acc[row[key]] ??= []).push(row);
    return acc;
  }, {});

// Un handler de insert genérico: hace eco de la fila insertada agregándole un id.
const echoWithId = (prefix) => {
  let n = 0;
  return (chain) => {
    const [row] = values(chain);
    n += 1;
    return { data: { id: `${prefix}-${n}`, ...row } };
  };
};

// 3 épicas × 4 stories × 6 tasks (una por frente) × 2 subtasks = justo los
// mínimos que exige el spec (≥3 épicas, ≥12 stories, ≥72 tasks, ≥144 subtasks).
// Las tasks se generan en orden INVERSO al de PLAN_FRENTES a propósito, para
// probar que insertPlanCascade realmente reordena por frente y no confía en
// el orden que manda Groq.
function buildGroqPlan({ epicas = 3, storiesPerEpica = 4, subtasksPerTask = 2 } = {}) {
  const frentesInvertidos = [...PLAN_FRENTES].reverse();

  return {
    epicas: Array.from({ length: epicas }, (_, e) => ({
      titulo: `Épica ${e + 1}`,
      descripcion: `Descripción de la épica ${e + 1}`,
      orden: e + 1,
      user_stories: Array.from({ length: storiesPerEpica }, (_, s) => ({
        titulo: `Story ${e + 1}.${s + 1}`,
        descripcion: 'Descripción de la story',
        criterios_aceptacion: 'Criterios de aceptación',
        orden: s + 1,
        tasks: frentesInvertidos.map((frente) => ({
          titulo: `Task ${frente}`,
          descripcion: `Descripción de la task ${frente}`,
          frente,
          orden: PLAN_FRENTES.indexOf(frente) + 1,
          subtasks: Array.from({ length: subtasksPerTask }, (_, st) => ({
            titulo: `Subtask ${st + 1} de ${frente}`,
            descripcion: 'Descripción de la subtask',
            tiempo_estimado_min: 20,
            orden: st + 1,
          })),
        })),
      })),
    })),
  };
}

beforeEach(() => {
  mockState.handlers = {};
  mockState.calls = [];
  groqCreate.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Plans E2E', () => {
  test('POST /api/ideas/:id/generate-plan — genera estructura jerárquica', async () => {
    groqCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(buildGroqPlan()) } }],
    });

    mockTables({
      work_plans: (chain) => (usedOp(chain, 'insert') ? { data: { id: PLAN_ID } } : { data: null }),
      ideas: { data: idea },
      respuestas: { data: [] },
      dynamic_respuestas: { data: [] },
      epicas: echoWithId('epica'),
      user_stories: echoWithId('story'),
      tasks: echoWithId('task'),
      subtasks: echoWithId('subtask'),
    });

    const res = await request(app).post(`/api/ideas/${IDEA_ID}/generate-plan`);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'ok', plan_id: PLAN_ID });
    expect(res.body.epicas_count).toBeGreaterThanOrEqual(3);
    expect(res.body.stories_count).toBeGreaterThanOrEqual(12);
    expect(res.body.tasks_count).toBeGreaterThanOrEqual(72);
    expect(res.body.subtasks_count).toBeGreaterThanOrEqual(144);

    const epicaRows = insertedRows('epicas');
    const storyRows = insertedRows('user_stories');
    const taskRows = insertedRows('tasks');
    const subtaskRows = insertedRows('subtasks');

    expect(epicaRows).toHaveLength(3);

    const storiesByEpica = groupBy(storyRows, 'epica_id');
    expect(Object.keys(storiesByEpica)).toHaveLength(3);
    Object.values(storiesByEpica).forEach((stories) => {
      expect(stories.length).toBeGreaterThanOrEqual(4);
      expect(stories.length).toBeLessThanOrEqual(6);
    });

    const tasksByStory = groupBy(taskRows, 'user_story_id');
    expect(Object.keys(tasksByStory)).toHaveLength(12);
    Object.values(tasksByStory).forEach((tasks) => {
      expect(tasks).toHaveLength(6);
      expect(tasks.map((t) => t.frente)).toEqual(PLAN_FRENTES);
    });

    const subtasksByTask = groupBy(subtaskRows, 'task_id');
    expect(Object.keys(subtasksByTask)).toHaveLength(72);
    Object.values(subtasksByTask).forEach((subtasks) => {
      expect(subtasks.length).toBeGreaterThanOrEqual(2);
      expect(subtasks.length).toBeLessThanOrEqual(3);
    });
  });

  test('POST /api/ideas/:id/generate-plan — si Groq da 429, avisa el límite diario en vez de un error genérico', async () => {
    const rateLimitError = Object.assign(new Error('Rate limit reached'), {
      status: 429,
      headers: { get: (name) => (name === 'retry-after' ? '927' : null) },
    });
    groqCreate.mockRejectedValue(rateLimitError);

    mockTables({
      work_plans: { data: null },
      ideas: { data: idea },
      respuestas: { data: [] },
      dynamic_respuestas: { data: [] },
    });

    const res = await request(app).post(`/api/ideas/${IDEA_ID}/generate-plan`);

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/límite diario/);
    expect(res.body.message).toMatch(/16 minutos/);
  });

  test('GET /api/plans/:plan_id/epicas — lista épicas ordenadas', async () => {
    mockTables({
      epicas: {
        data: [
          { id: 'e1', plan_id: PLAN_ID, titulo: 'Épica 1', orden: 1 },
          { id: 'e2', plan_id: PLAN_ID, titulo: 'Épica 2', orden: 2 },
        ],
      },
    });

    const res = await request(app).get(`/api/plans/${PLAN_ID}/epicas`);

    expect(res.status).toBe(200);
    expect(res.body.epicas).toHaveLength(2);
    expect(filters(lastCall('epicas'))).toEqual({ plan_id: PLAN_ID });
    const order = lastCall('epicas').ops.find((op) => op.name === 'order');
    expect(order.args).toEqual(['orden', { ascending: true }]);
  });

  test('GET /api/epicas/:epica_id/stories — lista stories de una épica', async () => {
    mockTables({
      user_stories: {
        data: [{ id: STORY_ID, epica_id: EPICA_ID, titulo: 'Story 1', orden: 1 }],
      },
    });

    const res = await request(app).get(`/api/epicas/${EPICA_ID}/stories`);

    expect(res.status).toBe(200);
    expect(res.body.stories).toHaveLength(1);
    expect(filters(lastCall('user_stories'))).toEqual({ epica_id: EPICA_ID });
  });

  test('GET /api/stories/:story_id/tasks — lista 6 tasks de una story', async () => {
    const tasks = PLAN_FRENTES.map((frente, i) => ({
      id: `t${i}`,
      user_story_id: STORY_ID,
      titulo: `Task ${frente}`,
      frente,
      orden: i + 1,
    }));
    mockTables({ tasks: { data: tasks } });

    const res = await request(app).get(`/api/stories/${STORY_ID}/tasks`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(6);
    expect(new Set(res.body.tasks.map((t) => t.frente)).size).toBe(6);
    expect(res.body.tasks.map((t) => t.frente)).toEqual(PLAN_FRENTES);
  });

  test('PATCH /api/epicas/:epica_id — ciclo pendiente → en_progreso → completado', async () => {
    mockTables({
      epicas: (chain) => ({
        data: { id: EPICA_ID, titulo: 'Épica 1', estado: 'pendiente', ...values(chain) },
      }),
    });

    for (const estado of ['pendiente', 'en_progreso', 'completada']) {
      const res = await request(app).patch(`/api/epicas/${EPICA_ID}`).send({ estado });
      expect(res.status).toBe(200);
      expect(res.body.epica.estado).toBe(estado);
    }
  });

  test('PATCH /api/subtasks/:subtask_id — valida tiempo_estimado_min ≤ 30', async () => {
    const tooLong = await request(app)
      .patch(`/api/subtasks/${SUBTASK_ID}`)
      .send({ tiempo_estimado_min: 31 });

    expect(tooLong.status).toBe(400);

    mockTables({
      subtasks: (chain) => ({ data: { id: SUBTASK_ID, titulo: 'Subtask', ...values(chain) } }),
    });

    const ok = await request(app)
      .patch(`/api/subtasks/${SUBTASK_ID}`)
      .send({ tiempo_estimado_min: 30 });

    expect(ok.status).toBe(200);
    expect(ok.body.subtask.tiempo_estimado_min).toBe(30);
  });

  test('GET /api/plans — lista todos los planes de todas las ideas, con epicas_count', async () => {
    mockTables({
      work_plans: {
        data: [
          {
            id: PLAN_ID,
            idea_id: IDEA_ID,
            created_at: '2026-07-20T00:00:00Z',
            ideas: { titulo: 'Paseador de perros', texto_idea: idea.texto_idea },
          },
        ],
      },
      epicas: { data: [{ id: EPICA_ID, plan_id: PLAN_ID }] },
    });

    const res = await request(app).get('/api/plans');

    expect(res.status).toBe(200);
    expect(res.body.plans).toEqual([
      {
        id: PLAN_ID,
        idea_id: IDEA_ID,
        created_at: '2026-07-20T00:00:00Z',
        idea_titulo: 'Paseador de perros',
        idea_texto: idea.texto_idea,
        epicas_count: 1,
      },
    ]);
  });
});
