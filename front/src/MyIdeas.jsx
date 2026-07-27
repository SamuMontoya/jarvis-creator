import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Lightbulb, ListTree, Pencil, Trash2 } from 'lucide-react';
import TabsFiltro from './components/TabsFiltro';
import ConfirmDialog from './components/ConfirmDialog';
import EditIdeaDialog from './components/EditIdeaDialog';
import Spinner from './components/Spinner';
import ErrorMessage from './components/ErrorMessage';
import { useToast } from './context/ToastContext';
import { api } from './api';
import { SUCCESS, IDEA_STATES, routes } from './constants';

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

function IconButton({ icon: Icon, label, onClick, disabled, tone = 'stone' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-paper-warm disabled:cursor-not-allowed disabled:opacity-40"
      style={{ color: tone === 'danger' ? 'var(--color-danger)' : 'var(--color-stone)' }}
    >
      <Icon size={16} strokeWidth={1.75} />
    </button>
  );
}

function MyIdeas() {
  const { notify } = useToast();
  const navigate = useNavigate();

  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editingIdea, setEditingIdea] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

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

  const handleView = useCallback(
    (idea) => {
      navigate(idea.estado === IDEA_STATES.REFINED ? routes.idea(idea.id) : routes.preguntas(idea.id));
    },
    [navigate]
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

  const handleSaveEdit = async (payload) => {
    setSavingEdit(true);
    try {
      const { idea } = await api.updateIdea(editingIdea.id, payload);
      setIdeas((prev) => prev.map((i) => (i.id === idea.id ? { ...i, ...idea } : i)));
      notify(SUCCESS.IDEA_UPDATED);
      setEditingIdea(null);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) return <Spinner label="Cargando tus ideas..." />;

  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 font-display text-3xl font-bold text-ink">Ideas</h1>
          <p className="mt-2 max-w-[520px] font-body text-stone">
            Todas tus ideas de negocio, desde el primer borrador hasta el plan de ejecución listo
            para correr.
          </p>
        </div>
        <button onClick={() => navigate(routes.newIdea())} className="ds-btn ds-btn-amber">
          <Lightbulb size={16} strokeWidth={1.75} />
          Nueva idea
        </button>
      </div>

      <TabsFiltro filter={filter} onFilterChange={setFilter} ideas={ideas} />

      {filteredIdeas.length === 0 ? (
        <div className="ds-card px-4 py-12 text-center text-stone">
          <p className="m-0 font-body">
            {ideas.length === 0 ? 'Todavía no tienes ideas.' : 'No hay ideas con este filtro.'}
          </p>
          {ideas.length === 0 && (
            <p className="m-0 mt-1 font-body">Crea tu primera idea para empezar.</p>
          )}
        </div>
      ) : (
        <div className="ds-card overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-dust">
                <th className="ds-label px-4 py-3 font-normal">Título</th>
                <th className="ds-label px-4 py-3 font-normal">Descripción</th>
                <th className="ds-label whitespace-nowrap px-4 py-3 font-normal">Creada</th>
                <th className="ds-label px-4 py-3 text-right font-normal">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredIdeas.map((idea) => {
                const isRefined = idea.estado === IDEA_STATES.REFINED;
                const isDeleting = pendingDelete?.id === idea.id && deleting;
                return (
                  <tr
                    key={idea.id}
                    className="cursor-pointer border-b border-dust last:border-b-0 hover:bg-paper-warm"
                    onClick={() => handleView(idea)}
                  >
                    <td className="px-4 py-3 font-display font-semibold text-ink">{idea.titulo}</td>
                    <td className="max-w-[320px] truncate px-4 py-3 font-body text-sm text-stone">
                      {idea.texto_idea}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-body text-sm text-stone">
                      {formatDate(idea.created_at)}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <IconButton icon={Eye} label={isRefined ? 'Ver idea' : 'Continuar'} onClick={() => handleView(idea)} />
                        <IconButton icon={Pencil} label="Editar" onClick={() => setEditingIdea(idea)} />
                        {idea.plan_id && (
                          <IconButton
                            icon={ListTree}
                            label="Ver plan"
                            onClick={() => navigate(routes.planes(idea.id))}
                          />
                        )}
                        <IconButton
                          icon={Trash2}
                          label="Eliminar"
                          tone="danger"
                          disabled={isDeleting}
                          onClick={() => setPendingDelete(idea)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <EditIdeaDialog
        idea={editingIdea}
        busy={savingEdit}
        onSave={handleSaveEdit}
        onCancel={() => setEditingIdea(null)}
      />

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
