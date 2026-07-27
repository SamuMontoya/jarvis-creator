import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createSupabaseMock, chainHelpers } from './supabaseMock.js';

const { values, conflictTarget, filters, usedOp } = chainHelpers;

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
const QUESTION_ID = '22222222-2222-4222-8222-222222222222';
const DYN_QUESTION_ID = '33333333-3333-4333-8333-333333333333';

const idea = { id: IDEA_ID, texto_idea: 'Una app para pasear perros', estado: 'draft' };

const mockTables = (handlers) => {
  mockState.handlers = handlers;
};

const lastCall = (table) => mockState.calls.filter((c) => c.table === table).at(-1);

beforeEach(() => {
  mockState.handlers = {};
  mockState.calls = [];
  groqCreate.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/health', () => {
  it('responde ok sin tocar la base', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('rutas desconocidas', () => {
  it('devuelve 404 con JSON, no HTML de Express', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
  });
});

describe('GET /api/ideas', () => {
  it('devuelve las ideas ordenadas por updated_at descendente', async () => {
    mockTables({ ideas: { data: [idea] }, work_plans: { data: [] } });

    const res = await request(app).get('/api/ideas');

    expect(res.status).toBe(200);
    expect(res.body.ideas).toHaveLength(1);

    const order = lastCall('ideas').ops.find((op) => op.name === 'order');
    expect(order.args).toEqual(['updated_at', { ascending: false }]);
  });

  it('nunca filtra el error crudo de la base al cliente', async () => {
    mockTables({
      ideas: { error: { message: 'relation "ideas" does not exist', code: '42P01' } },
    });

    const res = await request(app).get('/api/ideas');

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('42P01');
    expect(JSON.stringify(res.body)).not.toContain('does not exist');
  });
});

describe('POST /api/ideas', () => {
  it('rechaza ideas por debajo del mínimo con un mensaje específico', async () => {
    const res = await request(app)
      .post('/api/ideas')
      .send({ titulo: 'Un título válido', texto_idea: 'corta' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/al menos 10 caracteres/);
  });

  it('rechaza el body vacío', async () => {
    const res = await request(app).post('/api/ideas').send({});
    expect(res.status).toBe(400);
  });

  it('recorta los espacios antes de guardar', async () => {
    mockTables({ ideas: { data: idea } });

    const res = await request(app)
      .post('/api/ideas')
      .send({ titulo: '  Paseador de perros  ', texto_idea: '   Una app para pasear perros   ' });

    expect(res.status).toBe(201);
    expect(values(lastCall('ideas'))).toEqual([
      { titulo: 'Paseador de perros', texto_idea: 'Una app para pasear perros' },
    ]);
  });
});

describe('GET /api/ideas/:id', () => {
  it('devuelve 404 si la idea no existe', async () => {
    mockTables({ ideas: { data: null } });

    const res = await request(app).get(`/api/ideas/${IDEA_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Idea no encontrada');
  });

  it('adjunta las respuestas a la idea', async () => {
    mockTables({
      ideas: { data: idea },
      respuestas: { data: [{ id: 'r1', respuesta: 'Sí' }] },
    });

    const res = await request(app).get(`/api/ideas/${IDEA_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.idea.respuestas).toHaveLength(1);
  });
});

describe('PATCH /api/ideas/:id', () => {
  it('acepta los estados válidos', async () => {
    mockTables({ ideas: { data: { ...idea, estado: 'refined' } } });

    const res = await request(app).patch(`/api/ideas/${IDEA_ID}`).send({ estado: 'refined' });

    expect(res.status).toBe(200);
    expect(values(lastCall('ideas'))).toEqual({ estado: 'refined' });
  });

  it('rechaza un estado desconocido', async () => {
    const res = await request(app).patch(`/api/ideas/${IDEA_ID}`).send({ estado: 'publicada' });
    expect(res.status).toBe(400);
  });

  it('devuelve 404 si no actualizó ninguna fila', async () => {
    mockTables({ ideas: { data: null } });

    const res = await request(app).patch(`/api/ideas/${IDEA_ID}`).send({ estado: 'refined' });

    expect(res.status).toBe(404);
  });

  it('rechaza un id que no es un UUID con 400 en vez de reventar contra la base', async () => {
    const res = await request(app).patch('/api/ideas/no-es-un-uuid').send({ estado: 'refined' });

    expect(res.status).toBe(400);
    expect(mockState.calls.some((c) => c.table === 'ideas')).toBe(false);
  });
});

describe('DELETE /api/ideas/:id', () => {
  it('borra solo la idea y deja el cascade a la base', async () => {
    mockTables({ ideas: { data: { id: IDEA_ID } } });

    const res = await request(app).delete(`/api/ideas/${IDEA_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect(usedOp(lastCall('ideas'), 'delete')).toBe(true);
    expect(mockState.calls.some((c) => c.table === 'respuestas')).toBe(false);
  });

  it('devuelve 404 al borrar una idea inexistente', async () => {
    mockTables({ ideas: { data: null } });

    const res = await request(app).delete(`/api/ideas/${IDEA_ID}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/questions', () => {
  it('pide solo las preguntas activas ordenadas', async () => {
    mockTables({ generic_questions: { data: [{ id: QUESTION_ID, pregunta: 'P', orden: 1 }] } });

    const res = await request(app).get('/api/questions');

    expect(res.status).toBe(200);
    expect(filters(lastCall('generic_questions'))).toEqual({ activa: true });
  });
});

describe('POST /api/respuestas', () => {
  const validBody = {
    idea_id: IDEA_ID,
    generic_question_id: QUESTION_ID,
    respuesta: 'Una respuesta suficientemente larga',
  };

  it('hace upsert para que editar no choque con la constraint única', async () => {
    mockTables({ respuestas: { data: { id: 'r1' } } });

    const res = await request(app).post('/api/respuestas').send(validBody);

    expect(res.status).toBe(201);
    const chain = lastCall('respuestas');
    expect(usedOp(chain, 'upsert')).toBe(true);
    expect(conflictTarget(chain)).toBe('idea_id,generic_question_id');
  });

  it('rechaza un idea_id que no es UUID', async () => {
    const res = await request(app)
      .post('/api/respuestas')
      .send({ ...validBody, idea_id: 'no-es-uuid' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/UUID/);
  });

  it('rechaza respuestas demasiado cortas', async () => {
    const res = await request(app).post('/api/respuestas').send({ ...validBody, respuesta: 'ok' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/al menos 5 caracteres/);
  });
});

describe('GET /api/ideas/:id/respuestas', () => {
  it('devuelve 404 si la idea no existe', async () => {
    mockTables({ ideas: { data: null } });

    const res = await request(app).get(`/api/ideas/${IDEA_ID}/respuestas`);

    expect(res.status).toBe(404);
  });

  it('devuelve la lista cuando la idea existe', async () => {
    mockTables({
      ideas: { data: { id: IDEA_ID } },
      respuestas: { data: [{ id: 'r1', respuesta: 'Sí' }] },
    });

    const res = await request(app).get(`/api/ideas/${IDEA_ID}/respuestas`);

    expect(res.status).toBe(200);
    expect(res.body.respuestas).toHaveLength(1);
  });
});

describe('POST /api/ideas/:id/generate-dynamic-questions', () => {
  const groqReturns = (questions) =>
    groqCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ questions }) } }],
    });

  it('reutiliza las preguntas existentes sin llamar a Groq', async () => {
    mockTables({
      dynamic_questions: { data: [{ id: DYN_QUESTION_ID, pregunta: 'Ya existe', orden: 1 }] },
    });

    const res = await request(app).post(`/api/ideas/${IDEA_ID}/generate-dynamic-questions`);

    expect(res.status).toBe(200);
    expect(res.body.dynamic_questions).toHaveLength(1);
    expect(groqCreate).not.toHaveBeenCalled();
  });

  it('exige respuestas iniciales antes de generar', async () => {
    mockTables({
      dynamic_questions: { data: [] },
      ideas: { data: idea },
      respuestas: { data: [] },
    });

    const res = await request(app).post(`/api/ideas/${IDEA_ID}/generate-dynamic-questions`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Responde las preguntas iniciales/);
    expect(groqCreate).not.toHaveBeenCalled();
  });

  it('guarda las 10 preguntas que devuelve Groq', async () => {
    const generated = Array.from({ length: 10 }, (_, i) => ({ pregunta: `Dinámica ${i + 1}` }));
    groqReturns(generated);

    let dynamicCall = 0;
    mockTables({
      dynamic_questions: () => {
        dynamicCall += 1;
        // Primera llamada: lookup de existentes. Segunda: el upsert.
        return dynamicCall === 1
          ? { data: [] }
          : { data: generated.map((q, i) => ({ id: `d${i}`, pregunta: q.pregunta, orden: i + 1 })) };
      },
      ideas: { data: idea },
      respuestas: { data: [{ respuesta: 'Una respuesta', generic_questions: { pregunta: 'P1' } }] },
    });

    const res = await request(app).post(`/api/ideas/${IDEA_ID}/generate-dynamic-questions`);

    expect(res.status).toBe(200);
    expect(res.body.dynamic_questions).toHaveLength(10);
    expect(groqCreate).toHaveBeenCalledOnce();
  });

  it('devuelve un mensaje amigable si Groq falla', async () => {
    groqCreate.mockRejectedValue(new Error('rate limit exceeded'));

    mockTables({
      dynamic_questions: { data: [] },
      ideas: { data: idea },
      respuestas: { data: [{ respuesta: 'Una respuesta' }] },
    });

    const res = await request(app).post(`/api/ideas/${IDEA_ID}/generate-dynamic-questions`);

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/No pudimos generar/);
    expect(res.body.message).not.toMatch(/rate limit/);
  });

  it('trata un JSON malformado de Groq como fallo de generación', async () => {
    groqCreate.mockResolvedValue({ choices: [{ message: { content: 'esto no es JSON' } }] });

    mockTables({
      dynamic_questions: { data: [] },
      ideas: { data: idea },
      respuestas: { data: [{ respuesta: 'Una respuesta' }] },
    });

    const res = await request(app).post(`/api/ideas/${IDEA_ID}/generate-dynamic-questions`);

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/No pudimos generar/);
  });

  it('devuelve 404 si la idea no existe', async () => {
    mockTables({ dynamic_questions: { data: [] }, ideas: { data: null } });

    const res = await request(app).post(`/api/ideas/${IDEA_ID}/generate-dynamic-questions`);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/dynamic-respuestas', () => {
  const validBody = {
    idea_id: IDEA_ID,
    dynamic_question_id: DYN_QUESTION_ID,
    respuesta: 'Una respuesta profunda y larga',
  };

  it('hace upsert sobre (idea_id, dynamic_question_id)', async () => {
    mockTables({
      dynamic_questions: { data: { id: DYN_QUESTION_ID } },
      dynamic_respuestas: { data: { id: 'dr1' } },
    });

    const res = await request(app).post('/api/dynamic-respuestas').send(validBody);

    expect(res.status).toBe(201);
    expect(conflictTarget(lastCall('dynamic_respuestas'))).toBe('idea_id,dynamic_question_id');
  });

  it('rechaza una pregunta que no pertenece a la idea', async () => {
    mockTables({ dynamic_questions: { data: null } });

    const res = await request(app).post('/api/dynamic-respuestas').send(validBody);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/pregunta indicada no existe/);
  });

  it('valida el formato de dynamic_question_id', async () => {
    const res = await request(app)
      .post('/api/dynamic-respuestas')
      .send({ ...validBody, dynamic_question_id: '123' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/ideas/:id/dynamic-respuestas', () => {
  it('aplana la pregunta al nivel superior', async () => {
    mockTables({
      dynamic_respuestas: {
        data: [
          {
            id: 'dr1',
            respuesta: 'R',
            dynamic_questions: { pregunta: 'Pregunta dinámica', orden: 1 },
          },
        ],
      },
    });

    const res = await request(app).get(`/api/ideas/${IDEA_ID}/dynamic-respuestas`);

    expect(res.status).toBe(200);
    expect(res.body.dynamic_respuestas[0]).toMatchObject({
      pregunta: 'Pregunta dinámica',
      orden: 1,
    });
    expect(res.body.dynamic_respuestas[0].dynamic_questions).toBeUndefined();
  });
});

describe('Generación de documentos', () => {
  const withData = (extra = {}) =>
    mockTables({
      ideas: { data: idea },
      respuestas: {
        data: [{ respuesta: 'Los dueños no tienen tiempo', generic_questions: { pregunta: '¿Problema?' } }],
      },
      dynamic_respuestas: {
        data: [{ respuesta: 'Bogotá primero', dynamic_questions: { pregunta: '¿Dónde?', orden: 1 } }],
      },
      ...extra,
    });

  it('el markdown incluye la idea y ambas secciones', async () => {
    withData();

    const res = await request(app).post(`/api/ideas/${IDEA_ID}/generate-final-markdown`);

    expect(res.status).toBe(200);
    expect(res.body.markdown).toContain('Una app para pasear perros');
    expect(res.body.markdown).toContain('Definición (Descubrimiento Inicial)');
    expect(res.body.markdown).toContain('Análisis Profundo');
    expect(res.body.markdown).toContain('Los dueños no tienen tiempo');
    expect(res.body.markdown).toContain('Bogotá primero');
  });

  it('el markdown escapa caracteres especiales de Markdown', async () => {
    mockTables({
      ideas: { data: { ...idea, texto_idea: '# Título con *énfasis* [raro]' } },
      respuestas: {
        data: [{ respuesta: 'Usa `code` y _cursiva_', generic_questions: { pregunta: 'P' } }],
      },
      dynamic_respuestas: { data: [] },
    });

    const res = await request(app).post(`/api/ideas/${IDEA_ID}/generate-final-markdown`);

    expect(res.status).toBe(200);
    expect(res.body.markdown).toContain('\\*énfasis\\*');
    expect(res.body.markdown).toContain('\\`code\\`');
  });

  it('devuelve 404 si la idea no existe', async () => {
    mockTables({ ideas: { data: null } });

    const res = await request(app).post(`/api/ideas/${IDEA_ID}/generate-final-markdown`);

    expect(res.status).toBe(404);
  });

  it('ya no expone generate-final-html', async () => {
    const res = await request(app).post(`/api/ideas/${IDEA_ID}/generate-final-html`);

    expect(res.status).toBe(404);
  });
});
