import express from 'express';
import dotenv from 'dotenv';
import supabase from './supabaseClient.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});