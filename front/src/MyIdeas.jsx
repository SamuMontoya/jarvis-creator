import { useState, useEffect, useCallback, useMemo } from 'react';
import TabsFiltro from './components/TabsFiltro';
import IdeaCard from './components/IdeaCard';
import ConfirmDialog from './components/ConfirmDialog';
import Spinner from './components/Spinner';
import ErrorMessage from './components/ErrorMessage';
import { useApp } from './context/AppContext';
import { useToast } from './context/ToastContext';
import { api } from './api';
import { SUCCESS } from './constants';

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

function MyIdeas() {
  const { goToNewIdea, continueIdea } = useApp();
  const { notify } = useToast();

  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listIdeas();
      setIdeas(data.ideas || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredIdeas = useMemo(
    () => (filter === 'all' ? ideas : ideas.filter((idea) => idea.estado === filter)),
    [ideas, filter]
  );

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteIdea(pendingDelete.id);
      setIdeas((prev) => prev.filter((idea) => idea.id !== pendingDelete.id));
      notify(SUCCESS.IDEA_DELETED);
      setPendingDelete(null);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteRequest = useCallback(
    (ideaId) => setPendingDelete(ideas.find((idea) => idea.id === ideaId) || null),
    [ideas]
  );

  if (loading) return <Spinner label="Cargando tus ideas..." />;

  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '1rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <h2 style={{ margin: 0 }}>Mis Ideas</h2>
        <button
          onClick={goToNewIdea}
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

      <TabsFiltro filter={filter} onFilterChange={setFilter} ideas={ideas} />

      {filteredIdeas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
          <p>{ideas.length === 0 ? 'Todavía no tienes ideas.' : 'No hay ideas con este filtro.'}</p>
          {ideas.length === 0 && <p>¡Crea tu primera idea para empezar!</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredIdeas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onContinue={continueIdea}
              onDelete={handleDeleteRequest}
              deletingId={deleting ? pendingDelete?.id : null}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar idea"
        message="Se borrarán también todas sus respuestas. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export default MyIdeas;
