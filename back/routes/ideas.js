import express from 'express';
import supabase from '../supabaseClient.js';
import { ideaSchema, updateIdeaSchema, ideaIdParamSchema, firstValidationMessage } from '../validators.js';
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

    const ideas = data || [];
    const ideaIds = ideas.map((idea) => idea.id);

    // Attach plan_id per idea so the ideas list can offer a direct "view
    // plan" action without a click-through-and-hope: the button only ever
    // appears when a plan for THAT idea actually exists.
    let planIdByIdea = {};
    if (ideaIds.length > 0) {
      const { data: plans, error: plansError } = await supabase
        .from('work_plans')
        .select('id, idea_id')
        .in('idea_id', ideaIds);

      if (plansError) {
        return sendDbError(res, plansError, 'GET /ideas (plans)');
      }

      planIdByIdea = Object.fromEntries((plans || []).map((p) => [p.idea_id, p.id]));
    }

    res.json({
      status: 'ok',
      ideas: ideas.map((idea) => ({ ...idea, plan_id: planIdByIdea[idea.id] ?? null })),
    });
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
      .insert([{ titulo: validation.data.titulo, texto_idea: validation.data.texto_idea }])
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
    const paramsValidation = ideaIdParamSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(paramsValidation.error),
      });
    }

    const validation = updateIdeaSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: firstValidationMessage(validation.error),
      });
    }

    const updates = Object.fromEntries(
      Object.entries(validation.data).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(updates).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: 'error',
        message: MESSAGES.INVALID_INPUT,
      });
    }

    const { data, error } = await supabase
      .from('ideas')
      .update(updates)
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
