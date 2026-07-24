import { useState, useEffect } from 'react';

function MyIdeas({ onNewIdea, onContinueIdea, onDeleteIdea }) {
  const [ideas, setIdeas] = useState([]);
  const [filteredIdeas, setFilteredIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const fetchIdeas = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/ideas');
        const data = await response.json();
        if (data.ideas) {
          setIdeas(data.ideas);
          applyFilter(data.ideas);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchIdeas();
  }, []);

  const applyFilter = (ideasList) => {
    if (filter === 'all') {
      setFilteredIdeas(ideasList);
    } else {
      setFilteredIdeas(ideasList.filter(idea => idea.estado === filter));
    }
  };

  useEffect(() => {
    applyFilter(ideas);
  }, [filter]);

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

  const handleDelete = async (ideaId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta idea? Se borrarán también todas sus respuestas.')) {
      return;
    }

    setDeletingId(ideaId);
    try {
      const response = await fetch(`http://localhost:3001/api/ideas/${ideaId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.deleted) {
        setIdeas(prev => prev.filter(i => i.id !== ideaId));
        applyFilter(ideas.filter(i => i.id !== ideaId));
      }
    } catch (err) {
      setError('Error al eliminar la idea');
    } finally {
      setDeletingId(null);
    }
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
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

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilter('all')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: filter === 'all' ? '#007bff' : '#e9ecef',
            color: filter === 'all' ? 'white' : '#333',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Todas ({ideas.length})
        </button>
        <button
          onClick={() => setFilter('draft')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: filter === 'draft' ? '#ffc107' : '#e9ecef',
            color: filter === 'draft' ? '#333' : '#333',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Borradores ({ideas.filter(i => i.estado === 'draft').length})
        </button>
        <button
          onClick={() => setFilter('refined')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: filter === 'refined' ? '#28a745' : '#e9ecef',
            color: filter === 'refined' ? 'white' : '#333',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Completadas ({ideas.filter(i => i.estado === 'refined').length})
        </button>
      </div>

      {filteredIdeas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
          <p>No hay ideas{filter !== 'all' ? ` con filtro "${filter}"` : ''}</p>
          <p>¡Crea tu primera idea para empezar!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredIdeas.map((idea) => (
            <div
              key={idea.id}
              style={{
                padding: '1.5rem',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: '#fafafa',
                position: 'relative',
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
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => onContinueIdea(idea)}
                  style={{
                    flex: '1',
                    minWidth: '120px',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    backgroundColor: idea.estado === 'refined' ? '#6c757d' : '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  disabled={deletingId === idea.id}
                >
                  {idea.estado === 'refined' ? 'Ver' : 'Continuar'}
                </button>
                <button
                  onClick={() => handleDelete(idea.id)}
                  style={{
                    padding: '0.75rem 1rem',
                    fontSize: '1rem',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: deletingId === idea.id ? 'not-allowed' : 'pointer',
                    opacity: deletingId === idea.id ? 0.7 : 1,
                  }}
                  disabled={deletingId === idea.id}
                >
                  {deletingId === idea.id ? 'Eliminando...' : 'Eliminar'}
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