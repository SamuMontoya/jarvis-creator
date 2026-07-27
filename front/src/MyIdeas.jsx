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

const ESTADO_PILL = {
  draft: { label: 'Borrador', background: 'var(--color-paper-warm)', color: 'var(--color-stone)' },
  refined: { label: 'Completada', background: 'rgba(200,134,10,0.14)', color: 'var(--color-amber-dim)' },
};

function EstadoPill({ estado }) {
  const style = ESTADO_PILL[estado] || ESTADO_PILL.draft;
  return (
    <span
      className="inline-flex whitespace-nowrap rounded-full px-3 py-1 font-body text-xs font-medium"
      style={{ backgroundColor: style.background, color: style.color }}
    >
      {style.label}
    </span>
  );
}

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
        <div className="rounded-b-card border border-t-0 border-dust bg-white px-4 py-12 text-center text-stone shadow-sm">
          <p className="m-0 font-body">
            {ideas.length === 0 ? 'Todavía no tienes ideas.' : 'No hay ideas con este filtro.'}
          </p>
          {ideas.length === 0 && (
            <p className="m-0 mt-1 font-body">Crea tu primera idea para empezar.</p>
          )}
        </div>
      ) : (
        <>
          {/* Table: lg and up, where every column has room to breathe. */}
          <div className="hidden rounded-b-card border border-t-0 border-dust bg-white shadow-sm lg:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-dust">
                  <th className="ds-label px-4 py-3 font-bold">Título</th>
                  <th className="ds-label px-4 py-3 font-bold">Descripción</th>
                  <th className="ds-label px-4 py-3 font-bold">Estado</th>
                  <th className="ds-label whitespace-nowrap px-4 py-3 font-bold">Creada</th>
                  <th className="ds-label px-4 py-3 text-right font-bold">Acciones</th>
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
                      <td className="max-w-[280px] truncate px-4 py-3 font-body text-sm text-stone">
                        {idea.texto_idea}
                      </td>
                      <td className="px-4 py-3">
                        <EstadoPill estado={idea.estado} />
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

          {/* Stacked cards below lg — a table with 5 columns has no room to
              breathe on tablet/mobile, so it becomes a list instead. */}
          <div className="flex flex-col gap-3 rounded-b-card border border-t-0 border-dust bg-white p-3 shadow-sm lg:hidden">
            {filteredIdeas.map((idea) => {
              const isRefined = idea.estado === IDEA_STATES.REFINED;
              const isDeleting = pendingDelete?.id === idea.id && deleting;
              return (
                <div
                  key={idea.id}
                  onClick={() => handleView(idea)}
                  className="cursor-pointer rounded-lg border border-dust p-4"
                >
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <span className="font-display font-semibold text-ink">{idea.titulo}</span>
                    <EstadoPill estado={idea.estado} />
                  </div>
                  <p className="m-0 mb-2 font-body text-sm text-stone">{idea.texto_idea}</p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-body text-xs text-stone">{formatDate(idea.created_at)}</span>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
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
                  </div>
                </div>
              );
            })}
          </div>
        </>
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
