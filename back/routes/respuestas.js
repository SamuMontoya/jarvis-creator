import express from 'express';
import supabase from '../supabaseClient.js';
import { respuestaSchema, firstValidationMessage } from '../validators.js';
import { HTTP_STATUS, MESSAGES } from '../config.js';
import { sendDbError } from '../errorHandler.js';

const router = express.Router();

router.post('/respuestas', async (req, res, next) => {
  try {
    const validation = respuestaSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(validation.error),
      });
    }

    const { idea_id, generic_question_id, respuesta } = validation.data;

    // respuestas is UNIQUE(idea_id, generic_question_id): editing an answer must
    // overwrite the existing row instead of failing on the constraint.
    const { data, error } = await supabase
      .from('respuestas')
      .upsert([{ idea_id, generic_question_id, respuesta: respuesta.trim() }], {
        onConflict: 'idea_id,generic_question_id',
      })
      .select()
      .single();

    if (error) {
      return sendDbError(res, error, 'POST /respuestas');
    }

    res.status(HTTP_STATUS.CREATED).json({ status: 'ok', respuesta: data });
  } catch (err) {
    next(err);
  }
});

router.get('/ideas/:id/respuestas', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: idea, error: ideaError } = await supabase
      .from('ideas')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (ideaError) {
      return sendDbError(res, ideaError, 'GET /ideas/:id/respuestas (idea lookup)');
    }

    if (!idea) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ status: 'error', message: MESSAGES.IDEA_NOT_FOUND });
    }

    const { data: respuestas, error } = await supabase
      .from('respuestas')
      .select('*, generic_questions(pregunta, orden)')
      .eq('idea_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      return sendDbError(res, error, 'GET /ideas/:id/respuestas');
    }

    res.json({ status: 'ok', respuestas: respuestas || [] });
  } catch (err) {
    next(err);
  }
});

export default router;
