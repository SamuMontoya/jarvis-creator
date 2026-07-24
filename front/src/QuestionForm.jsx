import { useState, useEffect } from 'react';

function QuestionForm({ 
  idea_id, 
  currentQuestionIndex, 
  onNext, 
  onPrevious, 
  onComplete,
  editMode = false,
  onEditComplete 
}) {
  const [respuesta, setRespuesta] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [questionsError, setQuestionsError] = useState(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/questions');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error || 'Error al cargar preguntas');
        }

        setQuestions(data.questions || []);
      } catch (err) {
        setQuestionsError(err.message);
      } finally {
        setLoadingQuestions(false);
      }
    };

    fetchQuestions();
  }, []);

  const currentQuestion = questions[currentQuestionIndex];
  const isFirstQuestion = currentQuestionIndex === 0;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  // Load answer from localStorage when question changes
  useEffect(() => {
    if (currentQuestion?.id) {
      const storageKey = `jarvis_respuestas_${idea_id}`;
      const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (stored[currentQuestion.id]) {
        setRespuesta(stored[currentQuestion.id]);
      } else {
        setRespuesta('');
      }
    }
  }, [currentQuestionIndex, currentQuestion?.id, idea_id]);

  const saveAndNavigate = async (direction) => {
    setError(null);

    // Validate only for "next" direction
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
      const storageKey = `jarvis_respuestas_${idea_id}`;
      const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
      
      stored[currentQuestion.id] = respuesta.trim();
      
      localStorage.setItem(storageKey, JSON.stringify(stored));

      setRespuesta('');

      if (direction === 'next') {
        if (isLastQuestion) {
          if (editMode) {
            onEditComplete(currentQuestionIndex + 1); // go to resumen
          } else {
            onComplete();
          }
        } else {
          onNext(currentQuestionIndex + 1);
        }
      } else if (direction === 'previous') {
        if (editMode) {
          // In edit mode, "previous" goes back to resumen
          onEditComplete('back');
        } else {
          onPrevious(currentQuestionIndex - 1);
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
        <p>Cargando preguntas...</p>
      </div>
    );
  }

  if (questionsError) {
    return (
      <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '1rem', textAlign: 'center', color: 'red' }}>
        <p>Error al cargar preguntas: {questionsError}</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '1rem', textAlign: 'center' }}>
        <p>No hay preguntas disponibles</p>
      </div>
    );
  }

  const isEmpty = !respuesta || respuesta.trim() === '';

  return (
    <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '1rem' }}>
      <div style={{ marginBottom: '1.5rem', color: '#666', fontSize: '0.9rem' }}>
        Pregunta {currentQuestionIndex + 1} de {questions.length}
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '4px', marginBottom: '0.5rem' }}>
          <strong>{currentQuestion?.pregunta}</strong>
        </div>
        <progress value={currentQuestionIndex + 1} max={questions.length} style={{ width: '100%', height: '8px' }} />
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
          {editMode ? 'Volver al resumen' : 'Anterior'}
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
          {loading ? 'Guardando...' : isLastQuestion ? (editMode ? 'Ir al resumen' : 'Ir a Resumen') : 'Siguiente'}
        </button>
      </div>
    </div>
  );
}

export default QuestionForm;