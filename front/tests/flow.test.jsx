import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../src/App';
import {
  IDEA_ID,
  makeIdea,
  makeQuestions,
  makeDynamicQuestions,
  mockApi,
  renderApp,
  seedSession,
} from './helpers';

const QUESTIONS = makeQuestions(5);
const DYNAMIC_QUESTIONS = makeDynamicQuestions(10);

const answersFor = (questions, count) =>
  questions.slice(0, count).map((q, i) => ({
    id: `r${i}`,
    generic_question_id: q.id,
    respuesta: `Respuesta a la pregunta ${i + 1}`,
  }));

const dynamicAnswersFor = (questions, count) =>
  questions.slice(0, count).map((q, i) => ({
    id: `dr${i}`,
    dynamic_question_id: q.id,
    pregunta: q.pregunta,
    respuesta: `Respuesta profunda ${i + 1}`,
  }));

describe('Listado de ideas', () => {
  it('respeta el orden que envía el backend (updated_at DESC)', async () => {
    mockApi({
      'GET /ideas': {
        ideas: [
          makeIdea({ id: 'b', texto_idea: 'Idea reciente', updated_at: '2026-07-10T00:00:00Z' }),
          makeIdea({ id: 'a', texto_idea: 'Idea vieja', updated_at: '2026-07-01T00:00:00Z' }),
        ],
      },
    });

    renderApp(<App />);

    const headings = await screen.findAllByRole('heading', { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(['Idea reciente', 'Idea vieja']);
  });

  it('filtra por estado sin volver a pedir al backend', async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      'GET /ideas': {
        ideas: [
          makeIdea({ id: 'a', texto_idea: 'Borrador uno', estado: 'draft' }),
          makeIdea({ id: 'b', texto_idea: 'Completada uno', estado: 'refined' }),
        ],
      },
    });

    renderApp(<App />);
    await screen.findByText('Borrador uno');

    await user.click(screen.getByRole('button', { name: /Completadas \(1\)/ }));

    expect(screen.getByText('Completada uno')).toBeInTheDocument();
    expect(screen.queryByText('Borrador uno')).not.toBeInTheDocument();
    expect(calls.filter((c) => c.url.endsWith('/ideas')).length).toBe(1);
  });

  it('muestra un estado vacío accionable cuando no hay ideas', async () => {
    mockApi({ 'GET /ideas': { ideas: [] } });

    renderApp(<App />);

    expect(await screen.findByText('Todavía no tienes ideas.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva idea' })).toBeInTheDocument();
  });

  it('ofrece reintentar cuando la carga falla', async () => {
    const user = userEvent.setup();
    let attempt = 0;

    global.fetch.mockImplementation(async () => {
      attempt += 1;
      if (attempt === 1) throw new TypeError('Failed to fetch');
      return { ok: true, status: 200, json: async () => ({ ideas: [] }) };
    });

    renderApp(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/No pudimos conectar/);

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Todavía no tienes ideas.')).toBeInTheDocument();
  });
});

describe('Borrado de idea', () => {
  it('exige confirmación explícita antes de llamar al backend', async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      'GET /ideas': { ideas: [makeIdea({ texto_idea: 'Idea a borrar' })] },
      'DELETE /ideas': { deleted: true },
    });

    renderApp(<App />);
    await screen.findByText('Idea a borrar');

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    // El modal está abierto pero todavía no se llamó al backend.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'DELETE' && c.url.includes(IDEA_ID))).toBe(true);
    });
    expect(await screen.findByText('Idea eliminada')).toBeInTheDocument();
  });

  it('cancelar cierra el modal sin borrar', async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      'GET /ideas': { ideas: [makeIdea({ texto_idea: 'Idea intacta' })] },
    });

    renderApp(<App />);
    await screen.findByText('Idea intacta');

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(screen.getByText('Idea intacta')).toBeInTheDocument();
  });
});

describe('Creación de idea', () => {
  it('bloquea el envío hasta alcanzar el mínimo de caracteres', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /ideas': { ideas: [] },
      'POST /ideas': { idea: makeIdea() },
      'GET /questions': { questions: QUESTIONS },
      'GET /respuestas': { respuestas: [] },
    });

    renderApp(<App />);
    await screen.findByText('Todavía no tienes ideas.');
    await user.click(screen.getByRole('button', { name: 'Nueva idea' }));

    const submit = screen.getByRole('button', { name: 'Enviar' });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/Qué idea quieres construir/), 'corta');
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/Qué idea quieres construir/), ' pero ya suficientemente larga');
    expect(submit).toBeEnabled();
  });

  it('crea la idea y avanza a la primera pregunta', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /ideas': { ideas: [] },
      'POST /ideas': { idea: makeIdea() },
      'GET /questions': { questions: QUESTIONS },
      'GET /respuestas': { respuestas: [] },
    });

    renderApp(<App />);
    await screen.findByText('Todavía no tienes ideas.');
    await user.click(screen.getByRole('button', { name: 'Nueva idea' }));

    await user.type(
      screen.getByLabelText(/Qué idea quieres construir/),
      'Una app para pasear perros en Bogotá'
    );
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText(/Descubrimiento Inicial — Pregunta 1 de 5/)).toBeInTheDocument();
    expect(screen.getByText('Pregunta genérica 1')).toBeInTheDocument();
  });
});

describe('Preguntas genéricas', () => {
  const setup = (respuestas = []) =>
    mockApi({
      'GET /questions': { questions: QUESTIONS },
      'GET /respuestas': { respuestas },
      'POST /respuestas': { respuesta: { id: 'new' } },
      'GET /ideas': { idea: makeIdea() },
    });

  it('guarda la respuesta y avanza a la siguiente pregunta', async () => {
    const user = userEvent.setup();
    seedSession({ ideaId: IDEA_ID, stage: 'questions', questionIndex: 0, dynamicQuestionIndex: 0 });
    const calls = setup();

    renderApp(<App />);
    await screen.findByText('Pregunta genérica 1');

    await user.type(screen.getByRole('textbox'), 'Los dueños no tienen tiempo');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Pregunta genérica 2')).toBeInTheDocument();

    const saved = calls.find((c) => c.method === 'POST' && c.url.includes('/respuestas'));
    expect(saved.body).toMatchObject({
      idea_id: IDEA_ID,
      generic_question_id: QUESTIONS[0].id,
      respuesta: 'Los dueños no tienen tiempo',
    });
  });

  it('rellena la respuesta ya guardada al volver a una pregunta', async () => {
    seedSession({ ideaId: IDEA_ID, stage: 'questions', questionIndex: 0, dynamicQuestionIndex: 0 });
    setup(answersFor(QUESTIONS, 1));

    renderApp(<App />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('Respuesta a la pregunta 1');
    });
  });

  it('deshabilita "Anterior" en la primera pregunta', async () => {
    seedSession({ ideaId: IDEA_ID, stage: 'questions', questionIndex: 0, dynamicQuestionIndex: 0 });
    setup();

    renderApp(<App />);
    await screen.findByText('Pregunta genérica 1');

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  });

  it('la última pregunta lleva al resumen', async () => {
    const user = userEvent.setup();
    seedSession({ ideaId: IDEA_ID, stage: 'questions', questionIndex: 4, dynamicQuestionIndex: 0 });
    setup(answersFor(QUESTIONS, 5));

    renderApp(<App />);
    await screen.findByText('Pregunta genérica 5');

    await user.click(screen.getByRole('button', { name: 'Ir a Resumen' }));

    expect(await screen.findByText('Resumen de tu idea')).toBeInTheDocument();
  });
});

describe('Resumen y paso al análisis profundo', () => {
  it('lista las respuestas y permite entrar al análisis profundo', async () => {
    const user = userEvent.setup();
    seedSession({ ideaId: IDEA_ID, stage: 'resumen', questionIndex: 4, dynamicQuestionIndex: 0 });

    mockApi({
      'GET /questions': { questions: QUESTIONS },
      'GET /ideas': (call) => {
        if (call.url.includes('/dynamic-questions')) return { dynamic_questions: DYNAMIC_QUESTIONS };
        if (call.url.includes('/dynamic-respuestas')) return { dynamic_respuestas: [] };
        if (call.url.includes('/respuestas')) return { respuestas: answersFor(QUESTIONS, 5) };
        return { idea: makeIdea() };
      },
    });

    renderApp(<App />);

    expect(await screen.findByText('Resumen de tu idea')).toBeInTheDocument();
    expect(screen.getByText('1. Pregunta genérica 1')).toBeInTheDocument();
    expect(screen.getByText('5. Pregunta genérica 5')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continuar al análisis profundo' }));

    expect(await screen.findByText(/Análisis Profundo — Pregunta 1 de 10/)).toBeInTheDocument();
  });

  it('editar una respuesta abre esa pregunta y vuelve al resumen al guardar', async () => {
    const user = userEvent.setup();
    seedSession({ ideaId: IDEA_ID, stage: 'resumen', questionIndex: 4, dynamicQuestionIndex: 0 });

    mockApi({
      'GET /questions': { questions: QUESTIONS },
      'GET /ideas': (call) =>
        call.url.includes('/respuestas')
          ? { respuestas: answersFor(QUESTIONS, 5) }
          : { idea: makeIdea() },
      'POST /respuestas': { respuesta: { id: 'updated' } },
    });

    renderApp(<App />);
    await screen.findByText('Resumen de tu idea');

    await user.click(screen.getByText('2. Pregunta genérica 2'));

    expect(await screen.findByText('Pregunta genérica 2')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Respuesta a la pregunta 2');

    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'Respuesta corregida');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Resumen de tu idea')).toBeInTheDocument();
  });
});

describe('Análisis profundo', () => {
  it('genera las preguntas con Groq si todavía no existen', async () => {
    seedSession({
      ideaId: IDEA_ID,
      stage: 'dynamic-questions',
      questionIndex: 4,
      dynamicQuestionIndex: 0,
    });

    const calls = mockApi({
      'GET /ideas': (call) => {
        if (call.url.includes('/dynamic-questions')) return { dynamic_questions: [] };
        if (call.url.includes('/dynamic-respuestas')) return { dynamic_respuestas: [] };
        return { idea: makeIdea() };
      },
      'POST /generate-dynamic-questions': { dynamic_questions: DYNAMIC_QUESTIONS },
    });

    renderApp(<App />);

    expect(await screen.findByText('Pregunta dinámica 1')).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('generate-dynamic-questions'))).toBe(true);
  });

  it('no regenera si el backend ya tiene preguntas', async () => {
    seedSession({
      ideaId: IDEA_ID,
      stage: 'dynamic-questions',
      questionIndex: 4,
      dynamicQuestionIndex: 0,
    });

    const calls = mockApi({
      'GET /ideas': (call) => {
        if (call.url.includes('/dynamic-questions')) return { dynamic_questions: DYNAMIC_QUESTIONS };
        if (call.url.includes('/dynamic-respuestas')) return { dynamic_respuestas: [] };
        return { idea: makeIdea() };
      },
    });

    renderApp(<App />);
    await screen.findByText('Pregunta dinámica 1');

    expect(calls.some((c) => c.url.includes('generate-dynamic-questions'))).toBe(false);
  });

  it('la última pregunta dinámica lleva al resumen final', async () => {
    const user = userEvent.setup();
    seedSession({
      ideaId: IDEA_ID,
      stage: 'dynamic-questions',
      questionIndex: 4,
      dynamicQuestionIndex: 9,
    });

    mockApi({
      'GET /questions': { questions: QUESTIONS },
      'GET /ideas': (call) => {
        if (call.url.includes('/dynamic-questions')) return { dynamic_questions: DYNAMIC_QUESTIONS };
        if (call.url.includes('/dynamic-respuestas'))
          return { dynamic_respuestas: dynamicAnswersFor(DYNAMIC_QUESTIONS, 10) };
        if (call.url.includes('/respuestas')) return { respuestas: answersFor(QUESTIONS, 5) };
        return { idea: makeIdea() };
      },
      'POST /dynamic-respuestas': { respuesta: { id: 'x' } },
    });

    renderApp(<App />);
    await screen.findByText('Pregunta dinámica 10');

    await user.click(screen.getByRole('button', { name: 'Ver resumen final' }));

    expect(await screen.findByText('Resumen Final Completo')).toBeInTheDocument();
  });
});

describe('Resumen final y descargas', () => {
  const setupFinal = (extra = {}) =>
    mockApi({
      'GET /questions': { questions: QUESTIONS },
      'GET /ideas': (call) => {
        if (call.url.includes('/dynamic-respuestas'))
          return { dynamic_respuestas: dynamicAnswersFor(DYNAMIC_QUESTIONS, 10) };
        if (call.url.includes('/respuestas')) return { respuestas: answersFor(QUESTIONS, 5) };
        return { idea: makeIdea() };
      },
      ...extra,
    });

  const seedFinal = () =>
    seedSession({
      ideaId: IDEA_ID,
      stage: 'final-resume',
      questionIndex: 4,
      dynamicQuestionIndex: 9,
    });

  it('muestra ambas secciones de respuestas', async () => {
    seedFinal();
    setupFinal();

    renderApp(<App />);

    expect(await screen.findByText('Resumen Final Completo')).toBeInTheDocument();
    expect(screen.getByText('Definición (Descubrimiento Inicial)')).toBeInTheDocument();
    expect(screen.getByText('Análisis Profundo')).toBeInTheDocument();
    expect(screen.getByText('1. Pregunta genérica 1')).toBeInTheDocument();
    expect(screen.getByText('1. Pregunta dinámica 1')).toBeInTheDocument();
  });

  it('descarga el Markdown generado por el backend', async () => {
    const user = userEvent.setup();
    seedFinal();
    const calls = setupFinal({
      'POST /generate-final-markdown': { markdown: '# Mi idea\n\nContenido' },
    });

    renderApp(<App />);
    await screen.findByText('Resumen Final Completo');

    await user.click(screen.getByRole('button', { name: /Descargar Markdown/ }));

    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('generate-final-markdown'))).toBe(true);
    });
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(await screen.findByText('Documento descargado')).toBeInTheDocument();
  });

  it('descarga el HTML generado por el backend', async () => {
    const user = userEvent.setup();
    seedFinal();
    const calls = setupFinal({
      'POST /generate-final-html': { html: '<html><body>Mi idea</body></html>' },
    });

    renderApp(<App />);
    await screen.findByText('Resumen Final Completo');

    await user.click(screen.getByRole('button', { name: /Descargar HTML/ }));

    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('generate-final-html'))).toBe(true);
    });
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('convierte el markdown a PDF en el cliente', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    vi.doMock('../src/markdownToPdf', () => ({ markdownToPdf: async () => ({ save }) }));

    seedFinal();
    const calls = setupFinal({
      'POST /generate-final-markdown': { markdown: '# Mi idea\n\nContenido' },
    });

    renderApp(<App />);
    await screen.findByText('Resumen Final Completo');

    await user.click(screen.getByRole('button', { name: /Descargar PDF/ }));

    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('generate-final-markdown'))).toBe(true);
    });
  });

  it('avisa al usuario si la generación falla', async () => {
    const user = userEvent.setup();
    seedFinal();
    setupFinal({
      'POST /generate-final-markdown': {
        status: 500,
        body: { status: 'error', message: 'No pudimos generar el documento.' },
      },
    });

    renderApp(<App />);
    await screen.findByText('Resumen Final Completo');

    await user.click(screen.getByRole('button', { name: /Descargar Markdown/ }));

    expect(await screen.findByText('No pudimos generar el documento.')).toBeInTheDocument();
  });

  it('finalizar marca la idea como refined y vuelve al listado', async () => {
    const user = userEvent.setup();
    seedFinal();
    const calls = setupFinal({
      'PATCH /ideas': { idea: makeIdea({ estado: 'refined' }) },
    });

    renderApp(<App />);
    await screen.findByText('Resumen Final Completo');

    await user.click(screen.getByRole('button', { name: 'Finalizar idea' }));

    await waitFor(() => {
      const patch = calls.find((c) => c.method === 'PATCH');
      expect(patch?.body).toEqual({ estado: 'refined' });
    });
  });
});

describe('Recuperación de progreso tras recargar', () => {
  it('vuelve a la pregunta donde se quedó el usuario', async () => {
    seedSession({ ideaId: IDEA_ID, stage: 'questions', questionIndex: 2, dynamicQuestionIndex: 0 });

    mockApi({
      'GET /questions': { questions: QUESTIONS },
      'GET /ideas': (call) =>
        call.url.includes('/respuestas')
          ? { respuestas: answersFor(QUESTIONS, 2) }
          : { idea: makeIdea() },
    });

    renderApp(<App />);

    expect(await screen.findByText(/Pregunta 3 de 5/)).toBeInTheDocument();
    expect(screen.getByText('Pregunta genérica 3')).toBeInTheDocument();
  });

  it('ignora sesiones corruptas y arranca en el listado', async () => {
    localStorage.setItem('jarvis_session', 'no-es-json');
    mockApi({ 'GET /ideas': { ideas: [] } });

    renderApp(<App />);

    expect(await screen.findByText('Todavía no tienes ideas.')).toBeInTheDocument();
  });

  it('no restaura una etapa de edición huérfana', async () => {
    seedSession({
      ideaId: IDEA_ID,
      stage: 'questions-edit',
      questionIndex: 1,
      dynamicQuestionIndex: 0,
    });
    mockApi({ 'GET /ideas': { ideas: [] } });

    renderApp(<App />);

    expect(await screen.findByText('Todavía no tienes ideas.')).toBeInTheDocument();
  });
});
