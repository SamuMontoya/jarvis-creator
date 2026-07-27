import { z } from 'zod';
import {
  MESSAGES,
  MIN_IDEA_LENGTH,
  MIN_ANSWER_LENGTH,
  MIN_TITULO_LENGTH,
  MAX_TITULO_LENGTH,
  EPICA_ESTADOS,
  STORY_ESTADOS,
  TASK_ESTADOS,
  SUBTASK_ESTADOS,
  MAX_SUBTASK_MINUTOS,
} from './config.js';

const uuid = (field) => z.string().uuid(`${field} debe ser un UUID válido`);

const answer = z
  .string()
  .trim()
  .min(MIN_ANSWER_LENGTH, `La respuesta debe tener al menos ${MIN_ANSWER_LENGTH} caracteres`);

export const ideaSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(MIN_TITULO_LENGTH, `El título debe tener al menos ${MIN_TITULO_LENGTH} caracteres`)
    .max(MAX_TITULO_LENGTH, `El título no puede superar los ${MAX_TITULO_LENGTH} caracteres`),
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
  estado: z.enum(['draft', 'refined'], 'estado debe ser "draft" o "refined"').optional(),
  titulo: z
    .string()
    .trim()
    .min(MIN_TITULO_LENGTH, `El título debe tener al menos ${MIN_TITULO_LENGTH} caracteres`)
    .max(MAX_TITULO_LENGTH, `El título no puede superar los ${MAX_TITULO_LENGTH} caracteres`)
    .optional(),
  texto_idea: z
    .string()
    .trim()
    .min(MIN_IDEA_LENGTH, `La idea debe tener al menos ${MIN_IDEA_LENGTH} caracteres`)
    .optional(),
});

export const ideaIdParamSchema = z.object({
  id: uuid('id'),
});

export const planIdParamSchema = z.object({
  plan_id: uuid('plan_id'),
});

export const epicaIdParamSchema = z.object({
  epica_id: uuid('epica_id'),
});

export const updateEpicaSchema = z.object({
  titulo: z.string().trim().min(1, 'titulo no puede estar vacío').optional(),
  descripcion: z.string().trim().optional(),
  estado: z.enum(EPICA_ESTADOS, `estado debe ser uno de: ${EPICA_ESTADOS.join(', ')}`).optional(),
});

export const storyIdParamSchema = z.object({
  story_id: uuid('story_id'),
});

export const updateStorySchema = z.object({
  titulo: z.string().trim().min(1, 'titulo no puede estar vacío').optional(),
  descripcion: z.string().trim().optional(),
  criterios_aceptacion: z.string().trim().optional(),
  estado: z.enum(STORY_ESTADOS, `estado debe ser uno de: ${STORY_ESTADOS.join(', ')}`).optional(),
});

export const taskIdParamSchema = z.object({
  task_id: uuid('task_id'),
});

export const updateTaskSchema = z.object({
  titulo: z.string().trim().min(1, 'titulo no puede estar vacío').optional(),
  descripcion: z.string().trim().optional(),
  estado: z.enum(TASK_ESTADOS, `estado debe ser uno de: ${TASK_ESTADOS.join(', ')}`).optional(),
});

export const subtaskIdParamSchema = z.object({
  subtask_id: uuid('subtask_id'),
});

export const updateSubtaskSchema = z.object({
  titulo: z.string().trim().min(1, 'titulo no puede estar vacío').optional(),
  descripcion: z.string().trim().optional(),
  estado: z.enum(SUBTASK_ESTADOS, `estado debe ser uno de: ${SUBTASK_ESTADOS.join(', ')}`).optional(),
  tiempo_estimado_min: z
    .number()
    .int()
    .positive()
    .max(MAX_SUBTASK_MINUTOS, `tiempo_estimado_min no puede ser mayor a ${MAX_SUBTASK_MINUTOS}`)
    .optional(),
});

// zod v4 exposes parse failures on `.issues`; `.errors` was removed in v3.
export const firstValidationMessage = (error) =>
  error?.issues?.[0]?.message || MESSAGES.INVALID_INPUT;
