import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3001/api';

function DynamicQuestionForm({ 
  idea_id, 
  dynamic_questions: questionsProp, 
  currentQuestionIndex, 
  onNext, 
  onBack, 
  onComplete,
  editMode = false 
}) {
  const [respuesta, setRespuesta] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dynamic_questions, setDynamicQuestions] = useState(questionsProp || []);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [questionsError, setQuestionsError] = useState(null);

  useEffect(() => {
    if (questionsProp && questionsProp.length > 0) {
      setDynamicQuestions(questionsProp);
      setLoadingQuestions(false);
      return;
    }

    const fetchDynamicQuestions = async () => {
      try {
        const response = await fetch(`${API_BASE}/ideas/${idea_id}/dynamic-questions`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error || 'Error al cargar preguntas dinámicas');
        }

        if (data.dynamic_questions && data.dynamic_questions.length > 0) {
          setDynamicQuestions(data.dynamic_questions);
        } else {
          await generateDynamicQuestions();
        }
      } catch (err) {
        setQuestionsError(err.message);
      } finally {
        setLoadingQuestions(false);
      }
    };

    const generateDynamicQuestions = async () => {
      try {
        const response = await fetch(`${API_BASE}/ideas/${idea_id}/generate-dynamic-questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error || 'Error al generar preguntas dinámicas');
        }

        if (data.dynamic_questions && data.dynamic_questions.length > 0) {
          setDynamicQuestions(data.dynamic_questions);
        }
      } catch (err) {
        setQuestionsError(err.message);
      }
    };

    fetchDynamicQuestions();
  }, [idea_id, questionsProp]);

  const currentQuestion = dynamic_questions[currentQuestionIndex];
  const isFirstQuestion = currentQuestionIndex === 0;
  const isLastQuestion = currentQuestionIndex === dynamic_questions.length - 1;

  const saveAndNavigate = async (direction) => {
    setError(null);

    if (direction === 'next' && (!respuesta || respuesta.trim() === '')) {
      setError('La respuesta no puede estar vacía');
      return;
    }

    if (!currentQuestion?.id) {
      setError('No hay pregunta disponible');
      return;
    }

    setLoading(true);

    try {
      if (direction === 'next') {
        const response = await fetch(`${API_BASE}/dynamic-respuestas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idea_id,
            dynamic_question_id: currentQuestion.id,
            respuesta: respuesta.trim(),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error || 'Error al guardar la respuesta');
        }
      }

      setRespuesta('');

      if (direction === 'next') {
        if (isLastQuestion) {
          onComplete();
        } else {
          onNext(currentQuestionIndex + 1);
        }
      } else if (direction === 'previous') {
        if (currentQuestionIndex > 0) {
          onBack(currentQuestionIndex - 1);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    saveAndNavigate('next');
  };

  const handlePrevious = () => {
    saveAndNavigate('previous');
  };

  if (loadingQuestions) {
    return (
      <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '1rem', textAlign: 'center' }}>
        <p>Cargando preguntas dinámicas...</p>
      </div>
    );
  }

  if (questionsError) {
    return (
      <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '1rem', textAlign: 'center', color: 'red' }}>
        <p>Error al cargar preguntas dinámicas: {questionsError}</p>
      </div>
    );
  }

  if (dynamic_questions.length === 0) {
    return (
      <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '1rem', textAlign: 'center' }}>
        <p>No hay preguntas dinámicas disponibles</p>
      </div>
    );
  }

  const isEmpty = !respuesta || respuesta.trim() === '';

  return (
    <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '1rem' }}>
      <div style={{ marginBottom: '1.5rem', color: '#666', fontSize: '0.9rem' }}>
        Pregunta dinámica {currentQuestionIndex + 1} de {dynamic_questions.length}
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '4px', marginBottom: '0.5rem' }}>
          <strong>{currentQuestion?.pregunta}</strong>
        </div>
        <progress value={currentQuestionIndex + 1} max={dynamic_questions.length} style={{ width: '100%', height: '8px' }} />
      </div>

      {error && (
        <div style={{ color: 'red', marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#ffe6e6', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      <textarea
        value={respuesta}
        onChange={(e) => setRespuesta(e.target.value)}
        placeholder="Tu respuesta aquí"
        rows={4}
        style={{
          width: '100%',
          padding: '0.75rem',
          fontSize: '1rem',
          border: '1px solid #ccc',
          borderRadius: '4px',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
        disabled={loading}
      />

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <button
          type="button"
          onClick={handlePrevious}
          disabled={loading || isFirstQuestion}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: loading || isFirstQuestion ? '#ccc' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || isFirstQuestion ? 'not-allowed' : 'pointer',
          }}
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || isEmpty || !currentQuestion?.id}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: loading || isEmpty || !currentQuestion?.id ? '#ccc' : 
              isLastQuestion ? (editMode ? '#007bff' : '#dc3545') : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || isEmpty || !currentQuestion?.id ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Guardando...' : isLastQuestion ? (editMode ? 'Guardar y volver' : 'Finalizar') : 'Siguiente'}
        </button>
      </div>
    </div>
  );
}

export default DynamicQuestionForm;