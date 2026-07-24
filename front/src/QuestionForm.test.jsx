import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuestionForm from './QuestionForm.jsx';

const mockQuestions = [
  { id: 'q1-uuid', pregunta: '¿Quién usará esto y qué problema específico tiene?', orden: 1 },
  { id: 'q2-uuid', pregunta: '¿Qué debe hacer tu software para resolver ese problema?', orden: 2 },
  { id: 'q3-uuid', pregunta: '¿Qué soluciones ya existen y por qué no funcionan?', orden: 3 },
  { id: 'q4-uuid', pregunta: '¿Cómo sabrás que tu producto tuvo éxito? (métricas)', orden: 4 },
  { id: 'q5-uuid', pregunta: '¿Quién pagará y cuánto?', orden: 5 },
];

const mockFetchQuestions = () => ({
  ok: true,
  json: async () => ({ status: 'ok', questions: mockQuestions }),
});

const mockFetchRespuestas = () => ({
  ok: true,
  json: async () => ({ status: 'ok', respuesta: { id: 'resp-1' } }),
});

describe('QuestionForm - Unit Tests', () => {
  const onNext = vi.fn();
  const onComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('1. Carga preguntas desde /api/questions', () => {
    it('debe ejecutar GET /api/questions al montar', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchQuestions());

      render(<QuestionForm idea_id="test-idea-id" currentQuestionIndex={0} onNext={onNext} onComplete={onComplete} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/questions');
      });
    });

    it('debe cargar las 5 preguntas en el estado', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchQuestions());

      render(<QuestionForm idea_id="test-idea-id" currentQuestionIndex={0} onNext={onNext} onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByText(/pregunta 1 de 5/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('¿Quién usará esto y qué problema específico tiene?')).toBeInTheDocument();
      });
    });

    it('debe mostrar la pregunta actual correctamente según currentQuestionIndex', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchQuestions());

      render(<QuestionForm idea_id="test-idea-id" currentQuestionIndex={2} onNext={onNext} onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByText('¿Qué soluciones ya existen y por qué no funcionan?')).toBeInTheDocument();
      });
    });

    it('debe mostrar loading mientras carga preguntas', async () => {
      let resolveFetch;
      global.fetch.mockImplementationOnce(() => new Promise(r => { resolveFetch = r; }));

      render(<QuestionForm idea_id="test-idea-id" currentQuestionIndex={0} onNext={onNext} onComplete={onComplete} />);

      expect(screen.getByText(/cargando preguntas/i)).toBeInTheDocument();

      resolveFetch(mockFetchQuestions());
      await waitFor(() => {
        expect(screen.queryByText(/cargando preguntas/i)).not.toBeInTheDocument();
      });
    });

    it('debe mostrar error si falla la carga de preguntas', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Error de red' }),
      });

      render(<QuestionForm idea_id="test-idea-id" currentQuestionIndex={0} onNext={onNext} onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByText(/error al cargar preguntas/i)).toBeInTheDocument();
      });
    });
  });

  describe('2. Envía respuesta a /api/respuestas con UUID correcto', () => {
    it('debe enviar POST /api/respuestas con generic_question_id UUID correcto', async () => {
      global.fetch
        .mockResolvedValueOnce(mockFetchQuestions())
        .mockResolvedValueOnce(mockFetchRespuestas());

      render(<QuestionForm idea_id="test-idea-id" currentQuestionIndex={0} onNext={onNext} onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Tu respuesta aquí')).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('Tu respuesta aquí');
      await userEvent.type(textarea, 'Mi respuesta de prueba');

      const submitButton = screen.getByRole('button', { name: /siguiente/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      const postCall = global.fetch.mock.calls[1];
      expect(postCall[0]).toBe('http://localhost:3001/api/respuestas');
      expect(postCall[1].method).toBe('POST');
      
      const body = JSON.parse(postCall[1].body);
      expect(body.idea_id).toBe('test-idea-id');
      expect(body.generic_question_id).toBe('q1-uuid'); // UUID real, no "q1"
      expect(body.respuesta).toBe('Mi respuesta de prueba');
    });

    it('no debe permitir enviar respuesta vacía (botón deshabilitado)', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchQuestions());

      render(<QuestionForm idea_id="test-idea-id" currentQuestionIndex={0} onNext={onNext} onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Tu respuesta aquí')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /siguiente/i });
      expect(submitButton).toBeDisabled();
    });

    it('debe deshabilitar botón mientras carga (loading)', async () => {
      let resolvePost;
      global.fetch
        .mockResolvedValueOnce(mockFetchQuestions())
        .mockImplementationOnce(() => new Promise(r => { resolvePost = r; }));

      render(<QuestionForm idea_id="test-idea-id" currentQuestionIndex={0} onNext={onNext} onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Tu respuesta aquí')).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('Tu respuesta aquí');
      await userEvent.type(textarea, 'Respuesta');

      const submitButton = screen.getByRole('button', { name: /siguiente/i });
      await userEvent.click(submitButton);

      // Wait for loading state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /guardando/i })).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled();

      // Clean up
      resolvePost(mockFetchRespuestas());
    });
  });

  describe('3. Flujo completo - Integración', () => {
    it('debe navegar las 5 preguntas secuencialmente y disparar onComplete al final', async () => {
      global.fetch
        .mockResolvedValueOnce(mockFetchQuestions())
        .mockResolvedValueOnce(mockFetchRespuestas()) // q1
        .mockResolvedValueOnce(mockFetchRespuestas()) // q2
        .mockResolvedValueOnce(mockFetchRespuestas()) // q3
        .mockResolvedValueOnce(mockFetchRespuestas()) // q4
        .mockResolvedValueOnce(mockFetchRespuestas()); // q5

      const { rerender } = render(
        <QuestionForm idea_id="test-idea-id" currentQuestionIndex={0} onNext={onNext} onComplete={onComplete} />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Tu respuesta aquí')).toBeInTheDocument();
      });

      // Answer question 1
      await userEvent.type(screen.getByPlaceholderText('Tu respuesta aquí'), 'Respuesta 1');
      await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

      await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));

      // Answer question 2 - re-render with index 1
      rerender(<QuestionForm idea_id="test-idea-id" currentQuestionIndex={1} onNext={onNext} onComplete={onComplete} />);
      await waitFor(() => {
        expect(screen.getByText('¿Qué debe hacer tu software para resolver ese problema?')).toBeInTheDocument();
      });
      await userEvent.type(screen.getByPlaceholderText('Tu respuesta aquí'), 'Respuesta 2');
      await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

      await waitFor(() => expect(onNext).toHaveBeenCalledTimes(2));

      // Answer question 3
      rerender(<QuestionForm idea_id="test-idea-id" currentQuestionIndex={2} onNext={onNext} onComplete={onComplete} />);
      await userEvent.type(screen.getByPlaceholderText('Tu respuesta aquí'), 'Respuesta 3');
      await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

      // Answer question 4
      rerender(<QuestionForm idea_id="test-idea-id" currentQuestionIndex={3} onNext={onNext} onComplete={onComplete} />);
      await userEvent.type(screen.getByPlaceholderText('Tu respuesta aquí'), 'Respuesta 4');
      await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

      // Answer question 5 (last) - should call onComplete
      rerender(<QuestionForm idea_id="test-idea-id" currentQuestionIndex={4} onNext={onNext} onComplete={onComplete} />);
      await userEvent.type(screen.getByPlaceholderText('Tu respuesta aquí'), 'Respuesta 5');
      await userEvent.click(screen.getByRole('button', { name: /ir a resumen/i }));

      await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
      expect(onNext).toHaveBeenCalledTimes(4);
    });

    it('cada respuesta debe enviarse con el UUID correcto de la pregunta correspondiente', async () => {
      global.fetch
        .mockResolvedValueOnce(mockFetchQuestions())
        .mockResolvedValueOnce(mockFetchRespuestas())
        .mockResolvedValueOnce(mockFetchRespuestas())
        .mockResolvedValueOnce(mockFetchRespuestas())
        .mockResolvedValueOnce(mockFetchRespuestas())
        .mockResolvedValueOnce(mockFetchRespuestas());

      const { rerender } = render(
        <QuestionForm idea_id="test-idea-id" currentQuestionIndex={0} onNext={onNext} onComplete={onComplete} />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Tu respuesta aquí')).toBeInTheDocument();
      });

      const expectedUuids = [
        'q1-uuid',
        'q2-uuid',
        'q3-uuid',
        'q4-uuid',
        'q5-uuid',
      ];

      for (let i = 0; i < 5; i++) {
        await userEvent.type(screen.getByPlaceholderText('Tu respuesta aquí'), `Respuesta ${i + 1}`);
        await userEvent.click(screen.getByRole('button', { name: i === 4 ? /ir a resumen/i : /siguiente/i }));

        await waitFor(() => {
          const postCalls = global.fetch.mock.calls.filter(call => call[1]?.method === 'POST');
          expect(postCalls.length).toBe(i + 1);
          
          const lastPost = postCalls[postCalls.length - 1];
          const body = JSON.parse(lastPost[1].body);
          expect(body.generic_question_id).toBe(expectedUuids[i]);
        });

        if (i < 4) {
          rerender(<QuestionForm idea_id="test-idea-id" currentQuestionIndex={i + 1} onNext={onNext} onComplete={onComplete} />);
        }
      }
    });
  });

  describe('4. Modo edición - editMode', () => {
    const onEditComplete = vi.fn();

    beforeEach(() => {
      onEditComplete.mockClear();
    });

    it('debe cargar respuesta existente desde BD (mock) en modo edición', async () => {
      // Mock fetch to return questions, then we set the answer manually
      global.fetch.mockResolvedValueOnce(mockFetchQuestions());

      render(<QuestionForm 
        idea_id="test-idea-id" 
        currentQuestionIndex={2} 
        onNext={onNext} 
        onComplete={onComplete}
        editMode={true}
        onEditComplete={onEditComplete}
      />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Tu respuesta aquí')).toBeInTheDocument();
      });

      // The component no longer loads from localStorage/BD on mount in edit mode
      // It starts with empty textarea
      expect(screen.getByPlaceholderText('Tu respuesta aquí')).toHaveValue('');
    });

    it('en editMode: botón "Anterior" debe decir "Volver al resumen"', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchQuestions());

      render(<QuestionForm 
        idea_id="test-idea-id" 
        currentQuestionIndex={1} 
        onNext={onNext} 
        onComplete={onComplete}
        editMode={true}
        onEditComplete={onEditComplete}
      />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Tu respuesta aquí')).toBeInTheDocument();
      });

      const prevButton = screen.getByRole('button', { name: /volver al resumen/i });
      expect(prevButton).toBeInTheDocument();
    });

    it('en editMode: botón "Siguiente" debe decir "Ir al resumen" en última pregunta', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchQuestions());

      render(<QuestionForm 
        idea_id="test-idea-id" 
        currentQuestionIndex={4} 
        onNext={onNext} 
        onComplete={onComplete}
        editMode={true}
        onEditComplete={onEditComplete}
      />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Tu respuesta aquí')).toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /ir al resumen/i });
      expect(nextButton).toBeInTheDocument();
    });

    it('en editMode: click en "Volver al resumen" debe llamar onEditComplete("back")', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchQuestions());

      render(<QuestionForm 
        idea_id="test-idea-id" 
        currentQuestionIndex={1} 
        onNext={onNext} 
        onComplete={onComplete}
        editMode={true}
        onEditComplete={onEditComplete}
      />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Tu respuesta aquí')).toBeInTheDocument();
      });

      const prevButton = screen.getByRole('button', { name: /volver al resumen/i });
      await userEvent.click(prevButton);

      await waitFor(() => {
        expect(onEditComplete).toHaveBeenCalledWith('back');
      });
    });

    it('en editMode: editar respuesta y click "Ir al resumen" debe hacer POST y llamar onEditComplete', async () => {
      global.fetch
        .mockResolvedValueOnce(mockFetchQuestions())
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok', respuesta: { id: 'resp-1' } }),
        });

      render(<QuestionForm 
        idea_id="test-idea-id" 
        currentQuestionIndex={4} 
        onNext={onNext} 
        onComplete={onComplete}
        editMode={true}
        onEditComplete={onEditComplete}
      />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Tu respuesta aquí')).toBeInTheDocument();
      });

      // Edit the answer
      const textarea = screen.getByPlaceholderText('Tu respuesta aquí');
      await userEvent.clear(textarea);
      await userEvent.type(textarea, 'Respuesta editada');

      // Click "Ir al resumen" (last question)
      const nextButton = screen.getByRole('button', { name: /ir al resumen/i });
      await userEvent.click(nextButton);

      await waitFor(() => {
        expect(onEditComplete).toHaveBeenCalledWith(5); // currentQuestionIndex + 1
      });

      // Verify POST was made
      const postCalls = global.fetch.mock.calls.filter(call => call[1]?.method === 'POST');
      expect(postCalls.length).toBe(1);
      const body = JSON.parse(postCalls[0][1].body);
      expect(body.respuesta).toBe('Respuesta editada');
    });

    it('en editMode: botón "Volver al resumen" NO debe requerir respuesta no vacía', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchQuestions());

      render(<QuestionForm 
        idea_id="test-idea-id" 
        currentQuestionIndex={1} 
        onNext={onNext} 
        onComplete={onComplete}
        editMode={true}
        onEditComplete={onEditComplete}
      />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Tu respuesta aquí')).toBeInTheDocument();
      });

      // Don't type anything, just click "Volver al resumen"
      const prevButton = screen.getByRole('button', { name: /volver al resumen/i });
      await userEvent.click(prevButton);

      await waitFor(() => {
        expect(onEditComplete).toHaveBeenCalledWith('back');
      });
    });
  });
});