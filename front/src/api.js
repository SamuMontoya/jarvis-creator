import { API_BASE, ERRORS } from './constants';

async function request(path, { method = 'GET', body, fallbackError } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(ERRORS.NETWORK);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(fallbackError);
  }

  if (!response.ok) {
    throw new Error(data?.message || fallbackError);
  }

  return data;
}

export const api = {
  listIdeas: () => request('/ideas', { fallbackError: ERRORS.LOAD_IDEAS }),

  getIdea: (ideaId) => request(`/ideas/${ideaId}`, { fallbackError: ERRORS.LOAD_RESUMEN }),

  createIdea: (texto_idea) =>
    request('/ideas', { method: 'POST', body: { texto_idea }, fallbackError: ERRORS.CREATE_IDEA }),

  updateIdeaState: (ideaId, estado) =>
    request(`/ideas/${ideaId}`, { method: 'PATCH', body: { estado }, fallbackError: ERRORS.UPDATE_IDEA }),

  deleteIdea: (ideaId) =>
    request(`/ideas/${ideaId}`, { method: 'DELETE', fallbackError: ERRORS.DELETE_IDEA }),

  getQuestions: () => request('/questions', { fallbackError: ERRORS.LOAD_QUESTIONS }),

  getRespuestas: (ideaId) =>
    request(`/ideas/${ideaId}/respuestas`, { fallbackError: ERRORS.LOAD_RESUMEN }),

  saveRespuesta: (payload) =>
    request('/respuestas', { method: 'POST', body: payload, fallbackError: ERRORS.SAVE_ANSWER }),

  getDynamicQuestions: (ideaId) =>
    request(`/ideas/${ideaId}/dynamic-questions`, { fallbackError: ERRORS.LOAD_DYNAMIC_QUESTIONS }),

  generateDynamicQuestions: (ideaId) =>
    request(`/ideas/${ideaId}/generate-dynamic-questions`, {
      method: 'POST',
      fallbackError: ERRORS.GENERATE_QUESTIONS,
    }),

  getDynamicRespuestas: (ideaId) =>
    request(`/ideas/${ideaId}/dynamic-respuestas`, { fallbackError: ERRORS.LOAD_DYNAMIC_QUESTIONS }),

  saveDynamicRespuesta: (payload) =>
    request('/dynamic-respuestas', { method: 'POST', body: payload, fallbackError: ERRORS.SAVE_ANSWER }),

  generateHtml: (ideaId) =>
    request(`/ideas/${ideaId}/generate-final-html`, {
      method: 'POST',
      fallbackError: ERRORS.GENERATE_DOCUMENT,
    }),

  generateMarkdown: (ideaId) =>
    request(`/ideas/${ideaId}/generate-final-markdown`, {
      method: 'POST',
      fallbackError: ERRORS.GENERATE_DOCUMENT,
    }),

  generatePdfSource: (ideaId) =>
    request(`/ideas/${ideaId}/generate-final-pdf`, {
      method: 'POST',
      fallbackError: ERRORS.GENERATE_DOCUMENT,
    }),
};
