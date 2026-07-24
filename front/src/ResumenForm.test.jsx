import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResumenForm from './ResumenForm.jsx';

const mockIdea = {
  id: 'test-idea-id',
  texto_idea: 'Mi idea de prueba',
  estado: 'draft',
  created_at: '2024-01-01T00:00:00Z',
};

const mockQuestions = [
  { id: 'q1-uuid', pregunta: '¿Quién usará esto y qué problema específico tiene?', orden: 1 },
  { id: 'q2-uuid', pregunta: '¿Qué debe hacer tu software para resolver ese problema?', orden: 2 },
  { id: 'q3-uuid', pregunta: '¿Qué soluciones ya existen y por qué no funcionan?', orden: 3 },
  { id: 'q4-uuid', pregunta: '¿Cómo sabrás que tu producto tuvo éxito? (métricas)', orden: 4 },
  { id: 'q5-uuid', pregunta: '¿Quién pagará y cuánto?', orden: 5 },
];

const mockFetchIdea = () => ({
  ok: true,
  json: async () => ({ status: 'ok', idea: mockIdea }),
});

const mockFetchQuestions = () => ({
  ok: true,
  json: async () => ({ status: 'ok', questions: mockQuestions }),
});

const mockFetchRespuestas = () => ({
  ok: true,
  json: async () => ({ status: 'ok', respuesta: { id: 'resp-1' } }),
});

const mockPatchIdea = () => ({
  ok: true,
  json: async () => ({ status: 'ok', idea: { ...mockIdea, estado: 'refined' } }),
});

describe('ResumenForm - Unit Tests', () => {
  const onComplete = vi.fn();
  const onBack = vi.fn();
  const onEditQuestion = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    localStorage.clear();
  });

  describe('1. Carga datos al montar', () => {
    it('debe ejecutar GET /api/ideas/:id y /api/questions al montar', async () => {
      global.fetch
        .mockResolvedValueOnce(mockFetchIdea())
        .mockResolvedValueOnce(mockFetchQuestions());

      localStorage.setItem('jarvis_respuestas_test-idea-id', JSON.stringify({}));

      render(<ResumenForm idea_id="test-idea-id" onComplete={onComplete} onBack={onBack} onEditQuestion={onEditQuestion} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/ideas/test-idea-id');
        expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/questions');
      });
    });

    it('debe limpiar localStorage de otras ideas al cargar', async () => {
      global.fetch
        .mockResolvedValueOnce(mockFetchIdea())
        .mockResolvedValueOnce(mockFetchQuestions());

      localStorage.setItem('jarvis_respuestas_test-idea-id', JSON.stringify({ 'q1-uuid': 'answer1' }));
      localStorage.setItem('jarvis_respuestas_otra-idea', JSON.stringify({ 'q2-uuid': 'answer2' }));
      localStorage.setItem('jarvis_respuestas_tercera', JSON.stringify({ 'q3-uuid': 'answer3' }));

      render(<ResumenForm idea_id="test-idea-id" onComplete={onComplete} onBack={onBack} onEditQuestion={onEditQuestion} />);

      await waitFor(() => {
        expect(localStorage.getItem('jarvis_respuestas_otra-idea')).toBeNull();
        expect(localStorage.getItem('jarvis_respuestas_tercera')).toBeNull();
      });
      
      // Current idea should remain
      expect(localStorage.getItem('jarvis_respuestas_test-idea-id')).not.toBeNull();
    });

    it('debe cargar respuestas desde localStorage y preguntas desde API', async () => {
      const storedAnswers = {
        'q1-uuid': 'Mi respuesta 1',
        'q2-uuid': 'Mi respuesta 2',
      };
      localStorage.setItem('jarvis_respuestas_test-idea-id', JSON.stringify(storedAnswers));

      global.fetch
        .mockResolvedValueOnce(mockFetchIdea())
        .mockResolvedValueOnce(mockFetchQuestions());

      render(<ResumenForm idea_id="test-idea-id" onComplete={onComplete} onBack={onBack} onEditQuestion={onEditQuestion} />);

      await waitFor(() => {
        expect(screen.getByText('Mi respuesta 1')).toBeInTheDocument();
        expect(screen.getByText('Mi respuesta 2')).toBeInTheDocument();
      });
    });

    it('debe mostrar loading mientras carga datos', async () => {
      let resolveIdea, resolveQuestions;
      const ideaPromise = new Promise(r => { resolveIdea = r; });
      const questionsPromise = new Promise(r => { resolveQuestions = r; });
      
      global.fetch
        .mockImplementationOnce(() => ideaPromise)
        .mockImplementationOnce(() => questionsPromise);

      render(<ResumenForm idea_id="test-idea-id" onComplete={onComplete} onBack={onBack} onEditQuestion={onEditQuestion} />);

      expect(screen.getByText(/cargando resumen/i)).toBeInTheDocument();

      resolveIdea(mockFetchIdea());
      resolveQuestions(mockFetchQuestions());
      
      await waitFor(() => {
        expect(screen.queryByText(/cargando resumen/i)).not.toBeInTheDocument();
      });
    });

    it('debe mostrar error si falla la carga', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: 'Error al cargar la idea' }),
        })
        .mockResolvedValueOnce(mockFetchQuestions());

      render(<ResumenForm idea_id="test-idea-id" onComplete={onComplete} onBack={onBack} onEditQuestion={onEditQuestion} />);

      await waitFor(() => {
        expect(screen.getByText(/error al cargar la idea/i)).toBeInTheDocument();
      });
    });
  });

  describe('2. Click en respuesta navega a edición', () => {
    it('debe llamar onEditQuestion con el índice correcto al hacer click en respuesta', async () => {
      const storedAnswers = {
        'q1-uuid': 'Respuesta 1',
        'q2-uuid': 'Respuesta 2',
        'q3-uuid': 'Respuesta 3',
      };
      localStorage.setItem('jarvis_respuestas_test-idea-id', JSON.stringify(storedAnswers));

      global.fetch
        .mockResolvedValueOnce(mockFetchIdea())
        .mockResolvedValueOnce(mockFetchQuestions());

      render(<ResumenForm idea_id="test-idea-id" onComplete={onComplete} onBack={onBack} onEditQuestion={onEditQuestion} />);

      await waitFor(() => {
        expect(screen.getByText('Respuesta 1')).toBeInTheDocument();
      });

      // Click on second answer (index 1)
      const answerElements = screen.getAllByText('Respuesta 2');
      await userEvent.click(answerElements[0]);

      expect(onEditQuestion).toHaveBeenCalledWith(1);
    });

    it('debe renderizar cada respuesta con su pregunta correspondiente', async () => {
      const storedAnswers = {
        'q1-uuid': 'Respuesta a pregunta 1',
        'q3-uuid': 'Respuesta a pregunta 3',
      };
      localStorage.setItem('jarvis_respuestas_test-idea-id', JSON.stringify(storedAnswers));

      global.fetch
        .mockResolvedValueOnce(mockFetchIdea())
        .mockResolvedValueOnce(mockFetchQuestions());

      render(<ResumenForm idea_id="test-idea-id" onComplete={onComplete} onBack={onBack} onEditQuestion={onEditQuestion} />);

      await waitFor(() => {
        expect(screen.getByText(/¿Quién usará esto y qué problema específico tiene?/i)).toBeInTheDocument();
        expect(screen.getByText(/¿Qué soluciones ya existen y por qué no funcionan?/i)).toBeInTheDocument();
      });
    });
  });

  describe('3. Botón Guardar confirma y guarda en BD', () => {
    it('debe hacer POST a /api/respuestas para cada respuesta y PATCH a /api/ideas', async () => {
      const storedAnswers = {
        'q1-uuid': 'Respuesta 1',
        'q2-uuid': 'Respuesta 2',
      };
      localStorage.setItem('jarvis_respuestas_test-idea-id', JSON.stringify(storedAnswers));

      global.fetch
        .mockResolvedValueOnce(mockFetchIdea())
        .mockResolvedValueOnce(mockFetchQuestions())
        .mockResolvedValueOnce(mockFetchRespuestas()) // POST q1
        .mockResolvedValueOnce(mockFetchRespuestas()) // POST q2
        .mockResolvedValueOnce(mockPatchIdea());     // PATCH idea

      render(<ResumenForm idea_id="test-idea-id" onComplete={onComplete} onBack={onBack} onEditQuestion={onEditQuestion} />);

      await waitFor(() => {
        expect(screen.getByText('Respuesta 1')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(5); // GET idea + GET questions + 2 POST + 1 PATCH
      });

      // Check POST calls to /api/respuestas
      const postCalls = global.fetch.mock.calls.filter(call => call[1]?.method === 'POST');
      expect(postCalls.length).toBe(2);
      
      // Verify first POST
      expect(postCalls[0][0]).toBe('http://localhost:3001/api/respuestas');
      const body1 = JSON.parse(postCalls[0][1].body);
      expect(body1.idea_id).toBe('test-idea-id');
      expect(body1.generic_question_id).toBe('q1-uuid');
      expect(body1.respuesta).toBe('Respuesta 1');

      // Verify PATCH to /api/ideas
      const patchCalls = global.fetch.mock.calls.filter(call => call[1]?.method === 'PATCH');
      expect(patchCalls.length).toBe(1);
      expect(patchCalls[0][0]).toBe('http://localhost:3001/api/ideas/test-idea-id');
      const patchBody = JSON.parse(patchCalls[0][1].body);
      expect(patchBody.estado).toBe('refined');
    });

    it('debe limpiar localStorage y llamar onComplete tras guardar exitosamente', async () => {
      const storedAnswers = {
        'q1-uuid': 'Respuesta 1',
      };
      localStorage.setItem('jarvis_respuestas_test-idea-id', JSON.stringify(storedAnswers));

      global.fetch
        .mockResolvedValueOnce(mockFetchIdea())
        .mockResolvedValueOnce(mockFetchQuestions())
        .mockResolvedValueOnce(mockFetchRespuestas())
        .mockResolvedValueOnce(mockPatchIdea());

      render(<ResumenForm idea_id="test-idea-id" onComplete={onComplete} onBack={onBack} onEditQuestion={onEditQuestion} />);

      await waitFor(() => {
        expect(screen.getByText('Respuesta 1')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      });

      // localStorage should be cleared
      expect(localStorage.getItem('jarvis_respuestas_test-idea-id')).toBeNull();
    });

    it('debe mostrar botón deshabilitado mientras guarda', async () => {
      const storedAnswers = { 'q1-uuid': 'Respuesta 1' };
      localStorage.setItem('jarvis_respuestas_test-idea-id', JSON.stringify(storedAnswers));

      global.fetch
        .mockResolvedValueOnce(mockFetchIdea())
        .mockResolvedValueOnce(mockFetchQuestions())
        .mockImplementationOnce(() => new Promise(() => {})) // POST never resolves
        .mockResolvedValueOnce(mockPatchIdea());

      render(<ResumenForm idea_id="test-idea-id" onComplete={onComplete} onBack={onBack} onEditQuestion={onEditQuestion} />);

      await waitFor(() => {
        expect(screen.getByText('Respuesta 1')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled();
      });
    });
  });
});