import { API_BASE, ERRORS } from './constants';

async function request(path, { method = 'GET', body, fallbackError } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      // ngrok shows an HTML interstitial to anything that looks like a
      // browser request; this header bypasses it so fetch() gets JSON. A
      // no-op against a non-ngrok backend.
      headers: {
        'ngrok-skip-browser-warning': 'true',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
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

  generateMarkdown: (ideaId) =>
    request(`/ideas/${ideaId}/generate-final-markdown`, {
      method: 'POST',
      fallbackError: ERRORS.GENERATE_DOCUMENT,
    }),

  generatePlan: (ideaId) =>
    request(`/ideas/${ideaId}/generate-plan`, {
      method: 'POST',
      fallbackError: ERRORS.GENERATE_PLAN,
    }),

  getEpicas: (planId) =>
    request(`/plans/${planId}/epicas`, { fallbackError: ERRORS.LOAD_PLAN }),

  getStories: (epicaId) =>
    request(`/epicas/${epicaId}/stories`, { fallbackError: ERRORS.LOAD_PLAN }),

  getTasks: (storyId) =>
    request(`/stories/${storyId}/tasks`, { fallbackError: ERRORS.LOAD_PLAN }),

  getSubtasks: (taskId) =>
    request(`/tasks/${taskId}/subtasks`, { fallbackError: ERRORS.LOAD_PLAN }),

  updateEpica: (epicaId, payload) =>
    request(`/epicas/${epicaId}`, {
      method: 'PATCH',
      body: payload,
      fallbackError: ERRORS.UPDATE_ESTADO,
    }),

  updateStory: (storyId, payload) =>
    request(`/stories/${storyId}`, {
      method: 'PATCH',
      body: payload,
      fallbackError: ERRORS.UPDATE_ESTADO,
    }),

  updateTask: (taskId, payload) =>
    request(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: payload,
      fallbackError: ERRORS.UPDATE_ESTADO,
    }),

  updateSubtask: (subtaskId, payload) =>
    request(`/subtasks/${subtaskId}`, {
      method: 'PATCH',
      body: payload,
      fallbackError: ERRORS.UPDATE_ESTADO,
    }),
};
