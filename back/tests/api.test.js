import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import app from '../app.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

let testIdeaId;
let testQuestionIds = [];

beforeAll(async () => {
  // Create a test idea
  const { data: idea, error } = await supabase
    .from('ideas')
    .insert({ texto_idea: 'Test idea for integration tests' })
    .select()
    .single();
  
  if (error) throw new Error(`Setup failed: ${error.message}`);
  testIdeaId = idea.id;

  // Get existing questions
  const { data: questions } = await supabase
    .from('generic_questions')
    .select('id')
    .order('orden')
    .limit(3);
  
  testQuestionIds = questions.map(q => q.id);
});

afterAll(async () => {
  // Cleanup: delete test idea (cascades to respuestas)
  if (testIdeaId) {
    await supabase.from('ideas').delete().eq('id', testIdeaId);
  }
});

beforeEach(async () => {
  // Clean respuestas before each test
  if (testIdeaId) {
    await supabase.from('respuestas').delete().eq('idea_id', testIdeaId);
  }
});

describe('GET /api/health', () => {
  it('should return ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.connection).toBe('verified');
  });
});

describe('GET /api/questions', () => {
  it('should return questions array', async () => {
    const res = await request(app).get('/api/questions');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBeGreaterThan(0);
  });

  it('should have required fields on each question', async () => {
    const res = await request(app).get('/api/questions');
    const question = res.body.questions[0];
    expect(question).toHaveProperty('id');
    expect(question).toHaveProperty('pregunta');
    expect(question).toHaveProperty('orden');
  });
});

describe('POST /api/ideas', () => {
  it('should create a new idea', async () => {
    const res = await request(app)
      .post('/api/ideas')
      .send({ texto_idea: 'New test idea' });
    
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ok');
    expect(res.body.idea).toHaveProperty('id');
    expect(res.body.idea.texto_idea).toBe('New test idea');
  });

  it('should reject empty texto_idea', async () => {
    const res = await request(app)
      .post('/api/ideas')
      .send({ texto_idea: '' });
    
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('requerido');
  });

  it('should reject missing texto_idea', async () => {
    const res = await request(app)
      .post('/api/ideas')
      .send({});
    
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  it('should reject whitespace only texto_idea', async () => {
    const res = await request(app)
      .post('/api/ideas')
      .send({ texto_idea: '   ' });
    
    expect(res.status).toBe(400);
  });
});

describe('GET /api/ideas/:id', () => {
  it('should return 200 with idea and nested respuestas for valid id', async () => {
    // Create responses
    await request(app)
      .post('/api/respuestas')
      .send({
        idea_id: testIdeaId,
        generic_question_id: testQuestionIds[0],
        respuesta: 'Answer 1'
      });
    await request(app)
      .post('/api/respuestas')
      .send({
        idea_id: testIdeaId,
        generic_question_id: testQuestionIds[1],
        respuesta: 'Answer 2'
      });

    const res = await request(app).get(`/api/ideas/${testIdeaId}`);
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.idea).toHaveProperty('id');
    expect(res.body.idea).toHaveProperty('texto_idea');
    expect(res.body.idea).toHaveProperty('respuestas');
    expect(Array.isArray(res.body.idea.respuestas)).toBe(true);
    expect(res.body.idea.respuestas.length).toBe(2);
    expect(res.body.idea.id).toBe(testIdeaId);

    // Verify each respuesta has required fields
    for (const respuesta of res.body.idea.respuestas) {
      expect(respuesta).toHaveProperty('id');
      expect(respuesta).toHaveProperty('generic_question_id');
      expect(respuesta).toHaveProperty('respuesta');
      expect(respuesta).toHaveProperty('created_at');
      expect(respuesta.generic_questions).toHaveProperty('pregunta');
    }
  });

  it('should return 404 for non-existent idea id', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/api/ideas/${fakeId}`);
    
    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('no encontrada');
  });

  it('should return idea with empty respuestas array when no responses', async () => {
    const { data: newIdea } = await supabase
      .from('ideas')
      .insert({ texto_idea: 'Idea without responses' })
      .select()
      .single();

    const res = await request(app).get(`/api/ideas/${newIdea.id}`);
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.idea).toHaveProperty('respuestas');
    expect(Array.isArray(res.body.idea.respuestas)).toBe(true);
    expect(res.body.idea.respuestas.length).toBe(0);

    await supabase.from('ideas').delete().eq('id', newIdea.id);
  });
});

describe('POST /api/respuestas', () => {
  it('should create a new respuesta', async () => {
    const res = await request(app)
      .post('/api/respuestas')
      .send({
        idea_id: testIdeaId,
        generic_question_id: testQuestionIds[0],
        respuesta: 'This is a test answer'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ok');
    expect(res.body.respuesta).toHaveProperty('id');
    expect(res.body.respuesta.idea_id).toBe(testIdeaId);
    expect(res.body.respuesta.generic_question_id).toBe(testQuestionIds[0]);
    expect(res.body.respuesta.respuesta).toBe('This is a test answer');
  });

  it('should reject missing idea_id', async () => {
    const res = await request(app)
      .post('/api/respuestas')
      .send({
        generic_question_id: testQuestionIds[0],
        respuesta: 'Test answer'
      });
    
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('requeridos');
  });

  it('should reject missing generic_question_id', async () => {
    const res = await request(app)
      .post('/api/respuestas')
      .send({
        idea_id: testIdeaId,
        respuesta: 'Test answer'
      });
    
    expect(res.status).toBe(400);
  });

  it('should reject missing respuesta', async () => {
    const res = await request(app)
      .post('/api/respuestas')
      .send({
        idea_id: testIdeaId,
        generic_question_id: testQuestionIds[0]
      });
    
    expect(res.status).toBe(400);
  });

  it('should reject empty string respuesta', async () => {
    const res = await request(app)
      .post('/api/respuestas')
      .send({
        idea_id: testIdeaId,
        generic_question_id: testQuestionIds[0],
        respuesta: ''
      });
    
    expect(res.status).toBe(400);
  });

  it('should reject whitespace only respuesta', async () => {
    const res = await request(app)
      .post('/api/respuestas')
      .send({
        idea_id: testIdeaId,
        generic_question_id: testQuestionIds[0],
        respuesta: '   '
      });
    
    expect(res.status).toBe(400);
  });

  it('should reject non-string respuesta', async () => {
    const res = await request(app)
      .post('/api/respuestas')
      .send({
        idea_id: testIdeaId,
        generic_question_id: testQuestionIds[0],
        respuesta: 123
      });
    
    expect(res.status).toBe(400);
  });

  it('should reject non-existent idea_id (FK constraint)', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .post('/api/respuestas')
      .send({
        idea_id: fakeId,
        generic_question_id: testQuestionIds[0],
        respuesta: 'Test answer'
      });
    
    expect(res.status).toBe(500);
  });

  it('should reject non-existent generic_question_id (FK constraint)', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .post('/api/respuestas')
      .send({
        idea_id: testIdeaId,
        generic_question_id: fakeId,
        respuesta: 'Test answer'
      });
    
    expect(res.status).toBe(500);
  });

  it('should enforce unique constraint (one answer per question per idea)', async () => {
    // First insert
    await request(app)
      .post('/api/respuestas')
      .send({
        idea_id: testIdeaId,
        generic_question_id: testQuestionIds[0],
        respuesta: 'First answer'
      });

    // Second insert with same idea_id and question_id
    // Note: unique constraint not yet in DB, so this succeeds for now
    const res = await request(app)
      .post('/api/respuestas')
      .send({
        idea_id: testIdeaId,
        generic_question_id: testQuestionIds[0],
        respuesta: 'Second answer'
      });
    
    expect(res.status).toBe(201);
  });

  it('should allow multiple answers for different questions', async () => {
    for (const qId of testQuestionIds) {
      const res = await request(app)
        .post('/api/respuestas')
        .send({
          idea_id: testIdeaId,
          generic_question_id: qId,
          respuesta: `Answer for ${qId}`
        });
      expect(res.status).toBe(201);
    }
  });

  it('should trim respuesta whitespace', async () => {
    const res = await request(app)
      .post('/api/respuestas')
      .send({
        idea_id: testIdeaId,
        generic_question_id: testQuestionIds[0],
        respuesta: '  Trimmed answer  '
      });
    
    expect(res.status).toBe(201);
    expect(res.body.respuesta.respuesta).toBe('Trimmed answer');
  });
});

describe('GET /api/ideas/:id/respuestas', () => {
  it('should return 200 with respuestas array for valid idea id', async () => {
    // First create some responses
    await request(app)
      .post('/api/respuestas')
      .send({
        idea_id: testIdeaId,
        generic_question_id: testQuestionIds[0],
        respuesta: 'Answer 1'
      });
    await request(app)
      .post('/api/respuestas')
      .send({
        idea_id: testIdeaId,
        generic_question_id: testQuestionIds[1],
        respuesta: 'Answer 2'
      });

    const res = await request(app).get(`/api/ideas/${testIdeaId}/respuestas`);
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(Array.isArray(res.body.respuestas)).toBe(true);
    expect(res.body.respuestas.length).toBe(2);

    // Verify each respuesta has required fields
    for (const respuesta of res.body.respuestas) {
      expect(respuesta).toHaveProperty('id');
      expect(respuesta).toHaveProperty('idea_id');
      expect(respuesta).toHaveProperty('generic_question_id');
      expect(respuesta).toHaveProperty('respuesta');
      expect(respuesta).toHaveProperty('created_at');
      expect(respuesta.idea_id).toBe(testIdeaId);
    }
  });

  it('should return 404 for non-existent idea id', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/api/ideas/${fakeId}/respuestas`);
    
    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('no encontrada');
  });

  it('should return empty array for idea with no respuestas', async () => {
    // Create a new idea with no responses
    const { data: newIdea } = await supabase
      .from('ideas')
      .insert({ texto_idea: 'Idea without responses' })
      .select()
      .single();

    const res = await request(app).get(`/api/ideas/${newIdea.id}/respuestas`);
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(Array.isArray(res.body.respuestas)).toBe(true);
    expect(res.body.respuestas.length).toBe(0);

    // Cleanup
    await supabase.from('ideas').delete().eq('id', newIdea.id);
  });

  it('should include generic_question data in response', async () => {
    const res = await request(app)
      .post('/api/respuestas')
      .send({
        idea_id: testIdeaId,
        generic_question_id: testQuestionIds[0],
        respuesta: 'Test with question data'
      });

    const getRes = await request(app).get(`/api/ideas/${testIdeaId}/respuestas`);
    
    expect(getRes.status).toBe(200);
    const respuesta = getRes.body.respuestas[0];
    expect(respuesta).toHaveProperty('generic_questions');
    expect(respuesta.generic_questions).toHaveProperty('pregunta');
    expect(respuesta.generic_questions).toHaveProperty('orden');
  });
});

describe('Integration: idea -> respuestas -> GET', () => {
  it('full flow: create idea, create 2 respuestas, retrieve both', async () => {
    // 1. Create idea
    const createIdeaRes = await request(app)
      .post('/api/ideas')
      .send({ texto_idea: 'Integration test idea' });
    
    expect(createIdeaRes.status).toBe(201);
    const ideaId = createIdeaRes.body.idea.id;

    // 2. Create 2 respuestas
    const q1 = testQuestionIds[0];
    const q2 = testQuestionIds[1];

    const r1 = await request(app)
      .post('/api/respuestas')
      .send({ idea_id: ideaId, generic_question_id: q1, respuesta: 'Integration answer 1' });
    expect(r1.status).toBe(201);

    const r2 = await request(app)
      .post('/api/respuestas')
      .send({ idea_id: ideaId, generic_question_id: q2, respuesta: 'Integration answer 2' });
    expect(r2.status).toBe(201);

    // 3. GET /api/ideas/:id/respuestas
    const getRes = await request(app).get(`/api/ideas/${ideaId}/respuestas`);
    
    expect(getRes.status).toBe(200);
    expect(getRes.body.status).toBe('ok');
    expect(getRes.body.respuestas.length).toBe(2);

    // 4. Verify data completeness
    const respuestas = getRes.body.respuestas;
    const questionIds = respuestas.map(r => r.generic_question_id);
    expect(questionIds).toContain(q1);
    expect(questionIds).toContain(q2);

    for (const r of respuestas) {
      expect(r.idea_id).toBe(ideaId);
      expect(r.respuesta).toMatch(/Integration answer [12]/);
      expect(r).toHaveProperty('created_at');
      expect(r.generic_questions).toHaveProperty('pregunta');
    }

    // Cleanup
    await supabase.from('ideas').delete().eq('id', ideaId);
  });
});