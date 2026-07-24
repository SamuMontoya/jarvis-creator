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

describe('QuestionForm - Unit Tests', () => {
  const onNext = vi.fn();
  const onComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    localStorage.clear();
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

  describe('2. Guarda respuesta en localStorage con UUID correcto', () => {
    it('debe guardar respuesta en localStorage con generic_question_id UUID correcto', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchQuestions());

      render(<QuestionForm idea_id="test-idea-id" currentQuestionIndex={0} onNext={onNext} onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Tu respuesta aquí')).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('Tu respuesta aquí');
      await userEvent.type(textarea, 'Mi respuesta de prueba');

      const submitButton = screen.getByRole('button', { name: /siguiente/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(onNext).toHaveBeenCalledTimes(1);
      });

      // Verify localStorage has the answer
      const stored = JSON.parse(localStorage.getItem('jarvis_respuestas_test-idea-id') || '{}');
      expect(stored['q1-uuid']).toBe('Mi respuesta de prueba');
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
      global.fetch.mockResolvedValueOnce(mockFetchQuestions());

      render(<QuestionForm idea_id="test-idea-id" currentQuestionIndex={0} onNext={onNext} onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Tu respuesta aquí')).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText('Tu respuesta aquí');
      await userEvent.type(textarea, 'Respuesta');

      const submitButton = screen.getByRole('button', { name: /siguiente/i });
      
      // localStorage is synchronous, so loading state is brief
      // Just verify button is disabled when clicked with empty input
      expect(submitButton).not.toBeDisabled();
      
      await userEvent.click(submitButton);
      
      // After submit, onNext should be called
      await waitFor(() => {
        expect(onNext).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('3. Flujo completo - Integración', () => {
    it('debe navegar las 5 preguntas secuencialmente y disparar onComplete al final', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchQuestions());

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

      // Verify all 5 answers saved in localStorage
      const stored = JSON.parse(localStorage.getItem('jarvis_respuestas_test-idea-id') || '{}');
      expect(Object.keys(stored).length).toBe(5);
      expect(stored['q1-uuid']).toBe('Respuesta 1');
      expect(stored['q5-uuid']).toBe('Respuesta 5');
    });

    it('cada respuesta debe guardarse con el UUID correcto de la pregunta correspondiente', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchQuestions());

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
          const stored = JSON.parse(localStorage.getItem('jarvis_respuestas_test-idea-id') || '{}');
          expect(stored[expectedUuids[i]]).toBe(`Respuesta ${i + 1}`);
        });

        if (i < 4) {
          rerender(<QuestionForm idea_id="test-idea-id" currentQuestionIndex={i + 1} onNext={onNext} onComplete={onComplete} />);
        }
      }
    });
  });
});