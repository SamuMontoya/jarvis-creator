import { useState } from 'react';

function IdeaForm() {
  const [texto_idea, setTextoIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ideaId, setIdeaId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!texto_idea.trim()) {
      setError('La idea no puede estar vacía');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ texto_idea: texto_idea.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear la idea');
      }

      setIdeaId(data.idea_id);
      setTextoIdea('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '600px', margin: '2rem auto', padding: '1rem' }}>
      <textarea
        value={texto_idea}
        onChange={(e) => setTextoIdea(e.target.value)}
        placeholder="¿Qué idea quieres construir?"
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
      {error && (
        <div style={{ color: 'red', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading || !texto_idea.trim()}
        style={{
          marginTop: '0.5rem',
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          backgroundColor: loading || !texto_idea.trim() ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading || !texto_idea.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Enviando...' : 'Enviar'}
      </button>
      {ideaId && (
        <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
          Idea creada con ID: <strong>{ideaId}</strong>
        </div>
      )}
    </form>
  );
}

export default IdeaForm;