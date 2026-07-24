import { useState, useEffect } from 'react';

function ResumenForm({ idea_id, onComplete, onBack, onEditQuestion }) {
  const [idea, setIdea] = useState(null);
  const [respuestas, setRespuestas] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Clean up any remaining localStorage keys for other ideas (collect keys first to avoid modification during iteration)
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('jarvis_respuestas_') && key !== `jarvis_respuestas_${idea_id}`) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Also remove current idea's localStorage if exists
        localStorage.removeItem(`jarvis_respuestas_${idea_id}`);
        
        const [ideaResponse, questionsResponse, respuestasResponse] = await Promise.all([
          fetch(`http://localhost:3001/api/ideas/${idea_id}`),
          fetch('http://localhost:3001/api/questions'),
          fetch(`http://localhost:3001/api/ideas/${idea_id}/respuestas`),
        ]);

        const ideaData = await ideaResponse.json();
        const questionsData = await questionsResponse.json();
        const respuestasData = await respuestasResponse.json();

        if (!ideaResponse.ok) {
          throw new Error(ideaData.message || 'Error al cargar la idea');
        }

        if (!questionsResponse.ok) {
          throw new Error(questionsData.message || 'Error al cargar las preguntas');
        }

        if (!respuestasResponse.ok) {
          throw new Error(respuestasData.message || 'Error al cargar las respuestas');
        }

        if (ideaData.idea) setIdea(ideaData.idea);
        if (questionsData.questions) setQuestions(questionsData.questions);
        if (respuestasData.respuestas) setRespuestas(respuestasData.respuestas);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [idea_id]);

  const questionMap = {};
  questions.forEach(q => {
    questionMap[q.id] = q.pregunta;
  });

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);

    try {
      // Only update estado to 'refined' - answers are already in DB
      const patchResponse = await fetch(`http://localhost:3001/api/ideas/${idea_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ estado: 'refined' }),
      });

      const patchData = await patchResponse.json();

      if (!patchResponse.ok) {
        throw new Error(patchData.message || 'Error al actualizar estado de la idea');
      }

      // Clean up any remaining localStorage
      localStorage.removeItem(`jarvis_respuestas_${idea_id}`);

      onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '1rem', textAlign: 'center' }}>
        <p>Cargando resumen...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '1rem', textAlign: 'center', color: 'red' }}>
        <p>Error: {error}</p>
        <button onClick={onBack} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
          Volver al inicio
        </button>
      </div>
    );
  }

  if (!idea) {
    return (
      <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '1rem', textAlign: 'center' }}>
        <p>No se encontró la idea</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '1rem' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Resumen de tu idea</h2>

      <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Tu idea:</h3>
        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{idea.texto_idea || 'Sin texto'}</p>
      </div>

      <h3 style={{ marginBottom: '1rem' }}>Tus respuestas:</h3>
      {respuestas?.map((resp, idx) => {
        const pregunta = questionMap[resp.generic_question_id] || `Pregunta ${idx + 1}`;
        return (
          <div 
            key={resp.generic_question_id} 
            style={{ 
              marginBottom: '1.5rem', 
              padding: '1rem', 
              border: '1px solid #ddd', 
              borderRadius: '4px', 
              backgroundColor: '#fafafa',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onClick={() => onEditQuestion(idx)}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#333' }}>
              {idx + 1}. {pregunta}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', color: '#555' }}>{resp.respuesta}</div>
          </div>
        );
      })}

      {error && (
        <div style={{ color: 'red', marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#ffe6e6', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
        <button
          onClick={handleConfirm}
          disabled={saving}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: saving ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Guardando...' : 'Finalizar'}
        </button>
      </div>
    </div>
  );
}

export default ResumenForm;