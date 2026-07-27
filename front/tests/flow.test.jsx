import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../src/App';
import { routes } from '../src/constants';
import { IDEA_ID, makeIdea, makeQuestions, makeDynamicQuestions, mockApi, renderApp } from './helpers';

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
          makeIdea({
            id: 'b',
            titulo: 'Idea reciente',
            texto_idea: 'Descripción reciente',
            updated_at: '2026-07-10T00:00:00Z',
          }),
          makeIdea({
            id: 'a',
            titulo: 'Idea vieja',
            texto_idea: 'Descripción vieja',
            updated_at: '2026-07-01T00:00:00Z',
          }),
        ],
      },
    });

    renderApp(<App />);

    const rows = await screen.findAllByRole('row');
    // rows[0] is the header row.
    expect(rows[1]).toHaveTextContent('Idea reciente');
    expect(rows[2]).toHaveTextContent('Idea vieja');
  });

  it('filtra por estado sin volver a pedir al backend', async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      'GET /ideas': {
        ideas: [
          makeIdea({ id: 'a', titulo: 'Borrador uno', estado: 'draft' }),
          makeIdea({ id: 'b', titulo: 'Completada uno', estado: 'refined' }),
        ],
      },
    });

    renderApp(<App />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: /Completadas \(1\)/ }));

    // Ideas render twice in the DOM (table for lg+, stacked cards below lg —
    // real CSS picks one, jsdom has no layout so both exist); scope to the
    // table to assert a single, unambiguous match.
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Completada uno')).toBeInTheDocument();
    expect(table.queryByText('Borrador uno')).not.toBeInTheDocument();
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
      'GET /ideas': { ideas: [makeIdea({ titulo: 'Idea a borrar' })] },
      'DELETE /ideas': { deleted: true },
    });

    renderApp(<App />);
    await screen.findByRole('table');

    // Ideas render twice (table for lg+, stacked cards below lg); scope to
    // the table so there is exactly one "Eliminar" button to click.
    await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'Eliminar' }));

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
      'GET /ideas': { ideas: [makeIdea({ titulo: 'Idea intacta' })] },
    });

    renderApp(<App />);
    await screen.findByRole('table');

    await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'Eliminar' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(within(screen.getByRole('table')).getByText('Idea intacta')).toBeInTheDocument();
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
    await screen.findByLabelText('Título');

    const submit = screen.getByRole('button', { name: 'Enviar' });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Título'), 'Paseador de perros');
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Descripción'), 'corta');
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Descripción'), ' pero ya suficientemente larga');
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
    await screen.findByLabelText('Título');

    await user.type(screen.getByLabelText('Título'), 'Paseador de perros');
    await user.type(
      screen.getByLabelText('Descripción'),
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

  const renderAtPreguntas = () => renderApp(<App />, { initialEntries: [routes.preguntas(IDEA_ID)] });

  it('guarda la respuesta y avanza a la siguiente pregunta', async () => {
    const user = userEvent.setup();
    const calls = setup();

    renderAtPreguntas();
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
    setup(answersFor(QUESTIONS, 1));

    renderAtPreguntas();

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('Respuesta a la pregunta 1');
    });
  });

  it('deshabilita "Anterior" en la primera pregunta', async () => {
    setup();

    renderAtPreguntas();
    await screen.findByText('Pregunta genérica 1');

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  });

  it('la última pregunta lleva al resumen', async () => {
    const user = userEvent.setup();
    setup(answersFor(QUESTIONS, 4));

    renderAtPreguntas();
    await screen.findByText('Pregunta genérica 1');

    for (let i = 0; i < 4; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Siguiente' }));
      await screen.findByText(`Pregunta genérica ${i + 2}`);
    }

    await user.type(screen.getByRole('textbox'), 'Respuesta final suficientemente larga');
    await user.click(screen.getByRole('button', { name: 'Ir a Resumen' }));

    expect(await screen.findByText('Resumen de tu idea')).toBeInTheDocument();
  });
});

describe('Resumen y paso al análisis profundo', () => {
  const renderAtResumen = () => renderApp(<App />, { initialEntries: [routes.resumen(IDEA_ID)] });

  it('lista las respuestas y permite entrar al análisis profundo', async () => {
    const user = userEvent.setup();

    mockApi({
      'GET /questions': { questions: QUESTIONS },
      'GET /ideas': (call) => {
        if (call.url.includes('/dynamic-questions')) return { dynamic_questions: DYNAMIC_QUESTIONS };
        if (call.url.includes('/dynamic-respuestas')) return { dynamic_respuestas: [] };
        if (call.url.includes('/respuestas')) return { respuestas: answersFor(QUESTIONS, 5) };
        return { idea: makeIdea() };
      },
    });

    renderAtResumen();

    expect(await screen.findByText('Resumen de tu idea')).toBeInTheDocument();
    expect(screen.getByText('1. Pregunta genérica 1')).toBeInTheDocument();
    expect(screen.getByText('5. Pregunta genérica 5')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continuar al análisis profundo' }));

    expect(await screen.findByText(/Análisis Profundo — Pregunta 1 de 10/)).toBeInTheDocument();
  });

  it('editar una respuesta abre esa pregunta y vuelve al resumen al guardar', async () => {
    const user = userEvent.setup();

    mockApi({
      'GET /questions': { questions: QUESTIONS },
      'GET /ideas': (call) =>
        call.url.includes('/respuestas')
          ? { respuestas: answersFor(QUESTIONS, 5) }
          : { idea: makeIdea() },
      'POST /respuestas': { respuesta: { id: 'updated' } },
    });

    renderAtResumen();
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
  const renderAtAnalisis = () => renderApp(<App />, { initialEntries: [routes.analisis(IDEA_ID)] });

  it('genera las preguntas con Groq si todavía no existen', async () => {
    const calls = mockApi({
      'GET /ideas': (call) => {
        if (call.url.includes('/dynamic-questions')) return { dynamic_questions: [] };
        if (call.url.includes('/dynamic-respuestas')) return { dynamic_respuestas: [] };
        return { idea: makeIdea() };
      },
      'POST /generate-dynamic-questions': { dynamic_questions: DYNAMIC_QUESTIONS },
    });

    renderAtAnalisis();

    expect(await screen.findByText('Pregunta dinámica 1')).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('generate-dynamic-questions'))).toBe(true);
  });

  it('no regenera si el backend ya tiene preguntas', async () => {
    const calls = mockApi({
      'GET /ideas': (call) => {
        if (call.url.includes('/dynamic-questions')) return { dynamic_questions: DYNAMIC_QUESTIONS };
        if (call.url.includes('/dynamic-respuestas')) return { dynamic_respuestas: [] };
        return { idea: makeIdea() };
      },
    });

    renderAtAnalisis();
    await screen.findByText('Pregunta dinámica 1');

    expect(calls.some((c) => c.url.includes('generate-dynamic-questions'))).toBe(false);
  });

  it('la última pregunta dinámica lleva a la idea', async () => {
    const user = userEvent.setup();

    mockApi({
      'GET /questions': { questions: QUESTIONS },
      'GET /ideas': (call) => {
        if (call.url.includes('/dynamic-questions')) return { dynamic_questions: DYNAMIC_QUESTIONS };
        if (call.url.includes('/dynamic-respuestas'))
          return { dynamic_respuestas: dynamicAnswersFor(DYNAMIC_QUESTIONS, 9) };
        if (call.url.includes('/respuestas')) return { respuestas: answersFor(QUESTIONS, 5) };
        if (call.url.includes('/plan')) return { plan_id: null };
        return { idea: makeIdea() };
      },
      'POST /dynamic-respuestas': { respuesta: { id: 'x' } },
    });

    renderAtAnalisis();
    await screen.findByText('Pregunta dinámica 1');

    for (let i = 0; i < 9; i += 1) {
      await user.type(screen.getByRole('textbox'), 'Respuesta profunda suficientemente larga');
      await user.click(screen.getByRole('button', { name: 'Siguiente' }));
      await screen.findByText(`Pregunta dinámica ${i + 2}`);
    }

    await user.type(screen.getByRole('textbox'), 'Respuesta profunda final suficientemente larga');
    await user.click(screen.getByRole('button', { name: 'Ver resumen final' }));

    expect(await screen.findByText('Descubrimiento inicial')).toBeInTheDocument();
  });
});

describe('Idea (resumen final y descargas)', () => {
  const renderAtIdea = () => renderApp(<App />, { initialEntries: [routes.idea(IDEA_ID)] });

  const setupFinal = (extra = {}) =>
    mockApi({
      'GET /questions': { questions: QUESTIONS },
      'GET /ideas': (call) => {
        if (call.url.includes('/dynamic-respuestas'))
          return { dynamic_respuestas: dynamicAnswersFor(DYNAMIC_QUESTIONS, 10) };
        if (call.url.includes('/respuestas')) return { respuestas: answersFor(QUESTIONS, 5) };
        if (call.url.includes('/plan')) return { plan_id: null };
        return { idea: makeIdea() };
      },
      ...extra,
    });

  it('muestra ambas secciones de respuestas', async () => {
    setupFinal();

    renderAtIdea();

    await screen.findByText(/./, { selector: 'h1' });
    expect(screen.getByText('Descubrimiento inicial')).toBeInTheDocument();
    expect(screen.getByText('Análisis profundo')).toBeInTheDocument();
    expect(screen.getByText('1. Pregunta genérica 1')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByText('Análisis profundo'));
    expect(screen.getByText('1. Pregunta dinámica 1')).toBeInTheDocument();
  });

  it('solo ofrece la descarga en Markdown, sin HTML ni PDF', async () => {
    setupFinal();

    renderAtIdea();
    await screen.findByText(/./, { selector: 'h1' });

    expect(screen.getByRole('button', { name: /Descargar Markdown/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Descargar HTML/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Descargar PDF/ })).not.toBeInTheDocument();
  });

  it('descarga el Markdown generado por el backend', async () => {
    const user = userEvent.setup();
    const calls = setupFinal({
      'POST /generate-final-markdown': { markdown: '# Mi idea\n\nContenido' },
    });

    renderAtIdea();
    await screen.findByText(/./, { selector: 'h1' });

    await user.click(screen.getByRole('button', { name: /Descargar Markdown/ }));

    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('generate-final-markdown'))).toBe(true);
    });
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(await screen.findByText('Documento descargado')).toBeInTheDocument();
  });

  it('avisa al usuario si la generación falla', async () => {
    const user = userEvent.setup();
    setupFinal({
      'POST /generate-final-markdown': {
        status: 500,
        body: { status: 'error', message: 'No pudimos generar el documento.' },
      },
    });

    renderAtIdea();
    await screen.findByText(/./, { selector: 'h1' });

    await user.click(screen.getByRole('button', { name: /Descargar Markdown/ }));

    expect(await screen.findByText('No pudimos generar el documento.')).toBeInTheDocument();
  });

  it('finalizar marca la idea como refined y oculta el botón de finalizar', async () => {
    const user = userEvent.setup();
    const calls = setupFinal({
      'PATCH /ideas': { idea: makeIdea({ estado: 'refined' }) },
    });

    renderAtIdea();
    await screen.findByText(/./, { selector: 'h1' });

    await user.click(screen.getByRole('button', { name: 'Finalizar idea' }));

    await waitFor(() => {
      const patch = calls.find((c) => c.method === 'PATCH');
      expect(patch?.body).toEqual({ estado: 'refined' });
    });

    expect(await screen.findByText('Idea finalizada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finalizar idea' })).not.toBeInTheDocument();
  });

  it('si el backend rechaza el PATCH, avisa el error y se queda en la idea', async () => {
    const user = userEvent.setup();
    setupFinal({
      'PATCH /ideas': {
        status: 500,
        body: { status: 'error', message: 'No pudimos actualizar el estado de tu idea.' },
      },
    });

    renderAtIdea();
    await screen.findByText(/./, { selector: 'h1' });

    await user.click(screen.getByRole('button', { name: 'Finalizar idea' }));

    expect(await screen.findByText('No pudimos actualizar el estado de tu idea.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finalizar idea' })).toBeEnabled();
  });
});
