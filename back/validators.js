import { z } from 'zod';
import { MESSAGES, MIN_IDEA_LENGTH, MIN_ANSWER_LENGTH } from './config.js';

const uuid = (field) => z.string().uuid(`${field} debe ser un UUID válido`);

const answer = z
  .string()
  .trim()
  .min(MIN_ANSWER_LENGTH, `La respuesta debe tener al menos ${MIN_ANSWER_LENGTH} caracteres`);

export const ideaSchema = z.object({
  texto_idea: z
    .string()
    .trim()
    .min(MIN_IDEA_LENGTH, `La idea debe tener al menos ${MIN_IDEA_LENGTH} caracteres`),
});

export const respuestaSchema = z.object({
  idea_id: uuid('idea_id'),
  generic_question_id: uuid('generic_question_id'),
  respuesta: answer,
});

export const dynamicRespuestaSchema = z.object({
  idea_id: uuid('idea_id'),
  dynamic_question_id: uuid('dynamic_question_id'),
  respuesta: answer,
});

export const updateIdeaSchema = z.object({
  estado: z.enum(['draft', 'refined'], 'estado debe ser "draft" o "refined"'),
});

// zod v4 exposes parse failures on `.issues`; `.errors` was removed in v3.
export const firstValidationMessage = (error) =>
  error?.issues?.[0]?.message || MESSAGES.INVALID_INPUT;
