import { useState, useEffect, useCallback, useMemo } from 'react';
import SeccionRespuestas from './components/SeccionRespuestas';
import Spinner from './components/Spinner';
import ErrorMessage from './components/ErrorMessage';
import { useApp } from './context/AppContext';
import { api } from './api';
import { QUESTION_TYPES } from './constants';

function ResumenForm() {
  const { ideaId, editQuestion, startDynamicQuestions, backToLastQuestion } = useApp();

  const [idea, setIdea] = useState(null);
  const [respuestas, setRespuestas] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ideaData, questionsData, respuestasData] = await Promise.all([
        api.getIdea(ideaId),
        api.getQuestions(),
        api.getRespuestas(ideaId),
      ]);

      setIdea(ideaData.idea);
      setQuestions(questionsData.questions || []);
      setRespuestas(respuestasData.respuestas || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    load();
  }, [load]);

  const questionMap = useMemo(
    () => Object.fromEntries(questions.map((q) => [q.id, q.pregunta])),
    [questions]
  );

  const resolveQuestion = useCallback(
    (resp, idx) => questionMap[resp.generic_question_id] ?? `Pregunta ${idx + 1}`,
    [questionMap]
  );

  const handleEdit = useCallback(
    (index) => editQuestion(QUESTION_TYPES.GENERIC, index),
    [editQuestion]
  );

  if (loading) return <Spinner label="Cargando resumen..." />;

  if (error) return <ErrorMessage message={error} onRetry={load} />;

  if (!idea) return <ErrorMessage message="No se encontró la idea." onRetry={load} />;

  return (
    <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '1rem' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Resumen de tu idea</h2>

      <div
        style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Tu idea:</h3>
        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{idea.texto_idea}</p>
      </div>

      <SeccionRespuestas
        title="Definición (Descubrimiento Inicial)"
        respuestas={respuestas}
        emptyLabel="Todavía no has respondido ninguna pregunta."
        resolveQuestion={resolveQuestion}
        onEdit={handleEdit}
      />

      <p style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
        Toca cualquier respuesta para editarla.
      </p>

      <div
        style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          marginTop: '2rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={backToLastQuestion}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: 'white',
            color: '#495057',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Volver a las preguntas
        </button>
        <button
          onClick={startDynamicQuestions}
          style={{
            padding: '0.75rem 1.75rem',
            fontSize: '1rem',
            fontWeight: 'bold',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Continuar al análisis profundo
        </button>
      </div>
    </div>
  );
}

export default ResumenForm;
