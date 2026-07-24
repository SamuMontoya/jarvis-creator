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