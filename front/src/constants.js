export const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api`;

export const routes = {
  home: () => '/',
  allPlans: () => '/planes',
  newIdea: () => '/ideas/nueva',
  preguntas: (ideaId) => `/ideas/${ideaId}/preguntas`,
  resumen: (ideaId) => `/ideas/${ideaId}/resumen`,
  analisis: (ideaId) => `/ideas/${ideaId}/analisis`,
  idea: (ideaId) => `/ideas/${ideaId}`,
  planes: (ideaId) => `/ideas/${ideaId}/planes`,
  plan: (ideaId, planId) => `/ideas/${ideaId}/planes/${planId}`,
};

export const QUESTION_TYPES = {
  GENERIC: 'generic',
  DYNAMIC: 'dynamic',
};

export const IDEA_STATES = {
  DRAFT: 'draft',
  REFINED: 'refined',
};

export const MIN_IDEA_LENGTH = 10;
export const MIN_ANSWER_LENGTH = 5;
export const MIN_TITULO_LENGTH = 3;

export const ERRORS = {
  NETWORK: 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  IDEA_TITLE_EMPTY: 'Dale un título a tu idea.',
  IDEA_EMPTY: 'Escribe tu idea antes de continuar.',
  IDEA_TOO_SHORT: `Cuéntanos un poco más: al menos ${MIN_IDEA_LENGTH} caracteres.`,
  ANSWER_EMPTY: 'Escribe una respuesta antes de continuar.',
  ANSWER_TOO_SHORT: `Desarrolla un poco más tu respuesta: al menos ${MIN_ANSWER_LENGTH} caracteres.`,
  LOAD_IDEAS: 'No pudimos cargar tus ideas.',
  LOAD_QUESTIONS: 'No pudimos cargar las preguntas.',
  LOAD_DYNAMIC_QUESTIONS: 'No pudimos cargar las preguntas de análisis profundo.',
  LOAD_RESUMEN: 'No pudimos cargar el resumen de tu idea.',
  SAVE_ANSWER: 'No pudimos guardar tu respuesta.',
  CREATE_IDEA: 'No pudimos crear tu idea.',
  DELETE_IDEA: 'No pudimos eliminar la idea.',
  UPDATE_IDEA: 'No pudimos actualizar el estado de tu idea.',
  LOAD_PLANS: 'No pudimos cargar los planes de esta idea.',
  GENERATE_QUESTIONS: 'No pudimos generar las preguntas de análisis profundo.',
  GENERATE_DOCUMENT: 'No pudimos generar el documento.',
  LOAD_PLAN: 'No pudimos cargar el plan de trabajo.',
  UPDATE_ESTADO: 'No pudimos actualizar el estado.',
  GENERATE_PLAN: 'No pudimos generar el plan de trabajo.',
};

export const SUCCESS = {
  IDEA_CREATED: 'Idea creada',
  ANSWER_SAVED: 'Respuesta guardada',
  IDEA_DELETED: 'Idea eliminada',
  IDEA_UPDATED: 'Idea actualizada',
  IDEA_COMPLETED: 'Idea finalizada',
  DOCUMENT_READY: 'Documento descargado',
  PLAN_READY: 'Plan de trabajo generado',
};
