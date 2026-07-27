export const CONFIG = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
};

export const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

export const DYNAMIC_QUESTIONS_COUNT = 10;

// Orden fijo de frentes dentro de cada user story: una task por frente, en este orden.
export const PLAN_FRENTES = ['definicion', 'ux_ui', 'frontend', 'backend', 'testing', 'devops'];

export const PLAN_MAX_TOKENS = 10000;

export const EPICA_ESTADOS = ['pendiente', 'en_progreso', 'completada'];

export const STORY_ESTADOS = ['pendiente', 'en_progreso', 'completada'];

export const TASK_ESTADOS = ['pendiente', 'en_progreso', 'completada'];

export const SUBTASK_ESTADOS = ['pendiente', 'en_progreso', 'completada'];

export const MAX_SUBTASK_MINUTOS = 30;

export const MIN_IDEA_LENGTH = 10;
export const MIN_ANSWER_LENGTH = 5;
export const MIN_TITULO_LENGTH = 3;
export const MAX_TITULO_LENGTH = 80;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
};

// User-facing strings. Anything describing an internal failure stays generic so
// stack traces and driver details never reach the browser.
export const MESSAGES = {
  IDEA_NOT_FOUND: 'Idea no encontrada',
  INVALID_INPUT: 'Los datos enviados no son válidos',
  DB_ERROR: 'Ocurrió un error en el servidor. Inténtalo de nuevo.',
  IDEA_NOT_EXISTS: 'La idea indicada no existe',
  DYNAMIC_Q_NOT_EXISTS: 'La pregunta indicada no existe',
  NO_ANSWERS_YET: 'Responde las preguntas iniciales antes de generar el análisis profundo',
  GROQ_ERROR: 'No pudimos generar las preguntas de análisis profundo. Inténtalo de nuevo.',
  PLAN_GROQ_ERROR: 'No pudimos generar el plan de trabajo. Inténtalo de nuevo.',
  EPICA_NOT_FOUND: 'Épica no encontrada',
  STORY_NOT_FOUND: 'User story no encontrada',
  TASK_NOT_FOUND: 'Task no encontrada',
  SUBTASK_NOT_FOUND: 'Subtask no encontrada',
};
