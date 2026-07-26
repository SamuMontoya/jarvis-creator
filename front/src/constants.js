export const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api`;

export const STAGES = {
  IDEAS: 'ideas',
  IDEA: 'idea',
  QUESTIONS: 'questions',
  QUESTIONS_EDIT: 'questions-edit',
  RESUMEN: 'resumen',
  DYNAMIC_QUESTIONS: 'dynamic-questions',
  DYNAMIC_QUESTIONS_EDIT: 'dynamic-questions-edit',
  FINAL_RESUME: 'final-resume',
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

export const ERRORS = {
  NETWORK: 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
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
  GENERATE_QUESTIONS: 'No pudimos generar las preguntas de análisis profundo.',
  GENERATE_DOCUMENT: 'No pudimos generar el documento.',
};

export const SUCCESS = {
  IDEA_CREATED: 'Idea creada',
  ANSWER_SAVED: 'Respuesta guardada',
  IDEA_DELETED: 'Idea eliminada',
  IDEA_COMPLETED: 'Idea finalizada',
  DOCUMENT_READY: 'Documento descargado',
};
