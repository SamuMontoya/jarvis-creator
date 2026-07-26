import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { AppProvider } from '../src/context/AppContext';
import { ToastProvider } from '../src/context/ToastContext';

export const IDEA_ID = '11111111-1111-4111-8111-111111111111';

export const makeQuestions = (n = 5) =>
  Array.from({ length: n }, (_, i) => ({
    id: `q${i + 1}0000-0000-4000-8000-000000000000`,
    pregunta: `Pregunta genérica ${i + 1}`,
    orden: i + 1,
  }));

export const makeDynamicQuestions = (n = 10) =>
  Array.from({ length: n }, (_, i) => ({
    id: `d${i + 1}000000-0000-4000-8000-000000000000`,
    pregunta: `Pregunta dinámica ${i + 1}`,
    orden: i + 1,
  }));

export const makeIdea = (overrides = {}) => ({
  id: IDEA_ID,
  texto_idea: 'Una app para pasear perros en Bogotá',
  estado: 'draft',
  created_at: '2026-07-01T10:00:00Z',
  updated_at: '2026-07-02T10:00:00Z',
  ...overrides,
});

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

/**
 * Routes fetch calls by [method, path-substring] so a test only declares the
 * endpoints it cares about. Unmatched calls fail loudly instead of returning
 * undefined, which is what made the previous suite hang on stray promises.
 */
export function mockApi(routes) {
  const calls = [];

  global.fetch.mockImplementation(async (url, options = {}) => {
    const method = options.method || 'GET';
    calls.push({ method, url, body: options.body ? JSON.parse(options.body) : undefined });

    const match = Object.entries(routes).find(([key]) => {
      const [routeMethod, path] = key.split(' ');
      return routeMethod === method && url.includes(path);
    });

    if (!match) {
      throw new Error(`Unmocked request: ${method} ${url}`);
    }

    const handler = match[1];
    const result = typeof handler === 'function' ? handler(calls.at(-1)) : handler;
    return jsonResponse(result.body ?? result, result.status ?? 200);
  });

  return calls;
}

export const renderApp = (ui) =>
  render(
    <ToastProvider>
      <AppProvider>{ui}</AppProvider>
    </ToastProvider>
  );

export const seedSession = (session) =>
  localStorage.setItem('jarvis_session', JSON.stringify(session));

export const silenceConsoleError = () =>
  vi.spyOn(console, 'error').mockImplementation(() => {});
