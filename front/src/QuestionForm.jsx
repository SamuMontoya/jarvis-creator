import { useState, useEffect } from 'react';

function QuestionForm({ idea_id, currentQuestionIndex, onNext, onComplete }) {
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
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!respuesta.trim()) {
      setError('La respuesta no puede estar vacía');
      return;
    }

    if (!currentQuestion?.id) {
      setError('No hay pregunta disponible');
      return;
    }

    setLoading(true);

    try {
      // Get existing answers from localStorage (per idea_id)
      const storageKey = `jarvis_respuestas_${idea_id}`;
      const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
      
      // Add new answer
      stored[currentQuestion.id] = respuesta.trim();
      
      // Save back to localStorage
      localStorage.setItem(storageKey, JSON.stringify(stored));

      setRespuesta('');

      if (isLastQuestion) {
        onComplete();
      } else {
        onNext();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '700px', margin: '2rem auto', padding: '1rem' }}>
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

      <button
        type="submit"
        disabled={loading || !respuesta.trim() || !currentQuestion?.id}
        style={{
          marginTop: '1rem',
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          backgroundColor: loading || !respuesta.trim() || !currentQuestion?.id ? '#ccc' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading || !respuesta.trim() || !currentQuestion?.id ? 'not-allowed' : 'pointer',
          width: '100%',
        }}
      >
        {loading ? 'Guardando...' : isLastQuestion ? 'Finalizar' : 'Siguiente'}
      </button>
    </form>
  );
}

export default QuestionForm;