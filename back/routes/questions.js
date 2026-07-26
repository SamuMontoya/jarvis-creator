import express from 'express';
import supabase from '../supabaseClient.js';
import { sendDbError } from '../errorHandler.js';

const router = express.Router();

router.get('/questions', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('generic_questions')
      .select('*')
      .eq('activa', true)
      .order('orden', { ascending: true });

    if (error) {
      return sendDbError(res, error, 'GET /questions');
    }

    res.json({ status: 'ok', questions: data || [] });
  } catch (err) {
    next(err);
  }
});

export default router;
