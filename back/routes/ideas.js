import express from 'express';
import supabase from '../supabaseClient.js';
import { ideaSchema, updateIdeaSchema, firstValidationMessage } from '../validators.js';
import { HTTP_STATUS, MESSAGES } from '../config.js';
import { sendDbError } from '../errorHandler.js';

const router = express.Router();

router.get('/ideas', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('ideas')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      return sendDbError(res, error, 'GET /ideas');
    }

    res.json({ status: 'ok', ideas: data || [] });
  } catch (err) {
    next(err);
  }
});

router.post('/ideas', async (req, res, next) => {
  try {
    const validation = ideaSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(validation.error),
      });
    }

    const { data, error } = await supabase
      .from('ideas')
      .insert([{ texto_idea: validation.data.texto_idea }])
      .select()
      .single();

    if (error) {
      return sendDbError(res, error, 'POST /ideas');
    }

    res.status(HTTP_STATUS.CREATED).json({ status: 'ok', idea: data });
  } catch (err) {
    next(err);
  }
});

router.get('/ideas/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: idea, error: ideaError } = await supabase
      .from('ideas')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (ideaError) {
      return sendDbError(res, ideaError, 'GET /ideas/:id');
    }

    if (!idea) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ status: 'error', message: MESSAGES.IDEA_NOT_FOUND });
    }

    const { data: respuestas, error: respError } = await supabase
      .from('respuestas')
      .select('*, generic_questions(pregunta, orden)')
      .eq('idea_id', id)
      .order('created_at', { ascending: true });

    if (respError) {
      return sendDbError(res, respError, 'GET /ideas/:id (respuestas)');
    }

    res.json({ status: 'ok', idea: { ...idea, respuestas: respuestas || [] } });
  } catch (err) {
    next(err);
  }
});

router.patch('/ideas/:id', async (req, res, next) => {
  try {
    const validation = updateIdeaSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(validation.error),
      });
    }

    const { data, error } = await supabase
      .from('ideas')
      .update({ estado: validation.data.estado })
      .eq('id', req.params.id)
      .select()
      .maybeSingle();

    if (error) {
      return sendDbError(res, error, 'PATCH /ideas/:id');
    }

    if (!data) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ status: 'error', message: MESSAGES.IDEA_NOT_FOUND });
    }

    res.json({ status: 'ok', idea: data });
  } catch (err) {
    next(err);
  }
});

router.delete('/ideas/:id', async (req, res, next) => {
  try {
    // respuestas, dynamic_questions and dynamic_respuestas all declare
    // ON DELETE CASCADE against ideas, so one delete is enough.
    const { data, error } = await supabase
      .from('ideas')
      .delete()
      .eq('id', req.params.id)
      .select('id')
      .maybeSingle();

    if (error) {
      return sendDbError(res, error, 'DELETE /ideas/:id');
    }

    if (!data) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ status: 'error', message: MESSAGES.IDEA_NOT_FOUND });
    }

    res.json({ status: 'ok', deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
