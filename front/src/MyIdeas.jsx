import { useState, useEffect } from 'react';

function MyIdeas({ onNewIdea, onContinueIdea }) {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchIdeas = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/ideas');
        const data = await response.json();
        if (data.ideas) {
          setIdeas(data.ideas);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchIdeas();
  }, []);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (estado) => {
    const labels = {
      draft: 'Borrador',
      refined: 'Completada',
    };
    return labels[estado] || estado;
  };

  const getStatusColor = (estado) => {
    return estado === 'refined' ? '#28a745' : '#ffc107';
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '1rem', textAlign: 'center' }}>
        <p>Cargando tus ideas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '1rem', textAlign: 'center', color: 'red' }}>
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Mis Ideas</h2>
        <button
          onClick={onNewIdea}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Nueva idea
        </button>
      </div>

      {ideas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
          <p>No tienes ideas aún</p>
          <p>¡Crea tu primera idea para empezar!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {ideas.map((idea) => (
            <div
              key={idea.id}
              style={{
                padding: '1.5rem',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: '#fafafa',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#333' }}>
                  {idea.texto_idea}
                </h3>
                <span
                  style={{
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.8rem',
                    backgroundColor: getStatusColor(idea.estado),
                    color: idea.estado === 'refined' ? 'white' : '#333',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  {getStatusLabel(idea.estado)}
                </span>
              </div>
              <div style={{ color: '#666', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Creada: {formatDate(idea.created_at)}
                {idea.updated_at !== idea.created_at && (
                  <> | Actualizada: {formatDate(idea.updated_at)}</>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => onContinueIdea(idea)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    fontSize: '1rem',
                    backgroundColor: idea.estado === 'refined' ? '#6c757d' : '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: idea.estado === 'refined' ? 'not-allowed' : 'pointer',
                  }}
                  disabled={idea.estado === 'refined'}
                >
                  {idea.estado === 'refined' ? 'Completada' : 'Continuar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyIdeas;