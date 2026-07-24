import express from 'express';
import dotenv from 'dotenv';
import supabase from './supabaseClient.js';

dotenv.config();

const app = express();

app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('ideas')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    res.json({ status: 'ok', connection: 'verified' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/ideas', async (req, res) => {
  try {
    const { texto_idea } = req.body;

    if (!texto_idea || typeof texto_idea !== 'string' || texto_idea.trim() === '') {
      return res.status(400).json({ status: 'error', message: 'texto_idea es requerido y no puede estar vacío' });
    }

    const { data, error } = await supabase
      .from('ideas')
      .insert([{ texto_idea: texto_idea.trim() }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    res.status(201).json({ status: 'ok', idea: data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/ideas/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ status: 'error', message: 'id de idea es requerido' });
    }

    const { data: idea, error: ideaError } = await supabase
      .from('ideas')
      .select('*')
      .eq('id', id)
      .single();

    if (ideaError || !idea) {
      return res.status(404).json({ status: 'error', message: 'Idea no encontrada' });
    }

    const { data: respuestas, error: respError } = await supabase
      .from('respuestas')
      .select('*, generic_questions(pregunta, orden)')
      .eq('idea_id', id)
      .order('created_at', { ascending: true });

    if (respError) {
      return res.status(500).json({ status: 'error', message: respError.message });
    }

    res.json({ status: 'ok', idea: { ...idea, respuestas: respuestas || [] } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/respuestas', async (req, res) => {
  try {
    const { idea_id, generic_question_id, respuesta } = req.body;

    if (!idea_id || !generic_question_id || !respuesta) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'idea_id, generic_question_id y respuesta son requeridos' 
      });
    }

    if (typeof respuesta !== 'string' || respuesta.trim() === '') {
      return res.status(400).json({ 
        status: 'error', 
        message: 'respuesta debe ser un string no vacío' 
      });
    }

    const { data, error } = await supabase
      .from('respuestas')
      .insert([{ 
        idea_id, 
        generic_question_id, 
        respuesta: respuesta.trim() 
      }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    res.status(201).json({ status: 'ok', respuesta: data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/ideas/:id/respuestas', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ status: 'error', message: 'id de idea es requerido' });
    }

    const { data: idea, error: ideaError } = await supabase
      .from('ideas')
      .select('id')
      .eq('id', id)
      .single();

    if (ideaError || !idea) {
      return res.status(404).json({ status: 'error', message: 'Idea no encontrada' });
    }

    const { data: respuestas, error } = await supabase
      .from('respuestas')
      .select('*, generic_questions(pregunta, orden)')
      .eq('idea_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }

    res.json({ status: 'ok', respuestas: respuestas || [] });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/questions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('generic_questions')
      .select('*')
      .order('orden', { ascending: true });

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('Could not find the table')) {
        return res.json({ status: 'ok', questions: [] });
      }
      return res.status(500).json({ status: 'error', message: error.message });
    }

    res.json({ status: 'ok', questions: data || [] });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

export default app;