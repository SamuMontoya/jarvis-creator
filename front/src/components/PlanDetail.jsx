import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import Spinner from './Spinner';
import ErrorMessage from './ErrorMessage';
import { ERRORS, routes } from '../constants';

const ESTADOS = ['pendiente', 'en_progreso', 'completada'];

const ESTADO_STYLES = {
  pendiente: { backgroundColor: '#c8c2b8', color: '#111010', label: 'Pendiente' },
  en_progreso: { backgroundColor: '#c8860a', color: '#fdfcfa', label: 'En progreso' },
  completada: { backgroundColor: '#111010', color: '#c8860a', label: 'Completada' },
};

const FRENTE_LABELS = {
  definicion: 'Definición',
  ux_ui: 'UX/UI',
  frontend: 'Frontend',
  backend: 'Backend',
  testing: 'Testing',
  devops: 'DevOps',
};

const PATCHERS = {
  epica: api.updateEpica,
  story: api.updateStory,
  task: api.updateTask,
  subtask: api.updateSubtask,
};

const nextEstado = (estado) => ESTADOS[(ESTADOS.indexOf(estado) + 1) % ESTADOS.length];

function toggleInSet(set, id) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// Every subtask under a node, flattened — used to compute completion %.
function collectSubtasks(node, level) {
  if (level === 'subtask') return [node];
  if (level === 'task') return node.subtasks;
  if (level === 'story') return node.tasks.flatMap((t) => t.subtasks);
  return node.stories.flatMap((s) => s.tasks.flatMap((t) => t.subtasks));
}

function ProgressBar({ node, level }) {
  const subtasks = collectSubtasks(node, level);
  if (subtasks.length === 0) return null;
  const done = subtasks.filter((s) => s.estado === 'completada').length;
  const pct = Math.round((done / subtasks.length) * 100);
  return (
    <div className="ml-6 mr-3 h-1.5 flex-1 overflow-hidden rounded-full bg-paper-warm">
      <div className="h-full rounded-full bg-amber transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function EstadoPill({ estado, onToggle, disabled }) {
  const style = ESTADO_STYLES[estado] || ESTADO_STYLES.pendiente;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="ds-label flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1 transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
      style={{ backgroundColor: style.backgroundColor, color: style.color }}
    >
      {style.label}
    </button>
  );
}

function NodeHeader({ titulo, node, level, expanded, showCaret, onToggleExpand, onToggleEstado, disabled }) {
  return (
    <div
      onClick={onToggleExpand}
      className="flex items-center gap-2 py-2.5"
      style={{ cursor: onToggleExpand ? 'pointer' : 'default' }}
    >
      {showCaret && (
        <span className="flex-shrink-0 text-stone">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      )}
      <span className="font-body text-ink">{titulo}</span>
      {level !== 'subtask' && <ProgressBar node={node} level={level} />}
      <EstadoPill estado={node.estado} onToggle={onToggleEstado} disabled={disabled} />
    </div>
  );
}

const epicaCardClass = 'ds-card rounded-xl px-4 py-1 shadow-sm';
const storyCardClass = 'rounded-lg border-l-2 border-dust bg-paper-warm/40 pl-4 mt-2';
const taskCardClass = 'rounded-lg border-l-2 border-dust pl-4 mt-1.5';
const subtaskRowClass = 'flex items-center gap-2 py-1.5 pl-4';
const descripcionClass = 'font-body text-sm text-stone m-0 mb-2';
const tiempoBadgeClass = 'ml-auto font-body text-xs text-stone whitespace-nowrap';

function PlanDetail() {
  const { ideaId, planId } = useParams();
  const navigate = useNavigate();
  const [epicas, setEpicas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedEpicas, setExpandedEpicas] = useState(new Set());
  const [expandedStories, setExpandedStories] = useState(new Set());
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [updatingId, setUpdatingId] = useState(null);
  const { notify } = useToast();

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Single batched request for the whole tree — no more fetch-per-node.
      const { epicas: tree } = await api.getFullPlan(planId);
      setEpicas(tree || []);
    } catch (err) {
      setError(err.message || ERRORS.LOAD_PLAN);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const toggleEpica = (id) => setExpandedEpicas((prev) => toggleInSet(prev, id));
  const toggleStory = (id) => setExpandedStories((prev) => toggleInSet(prev, id));
  const toggleTask = (id) => setExpandedTasks((prev) => toggleInSet(prev, id));

  // Every id is a UUID unique across the whole tree, so matching by (level, id)
  // alone is enough — no need to thread parent ids through to locate a node.
  const applyPatch = useCallback((level, id, patch) => {
    setEpicas((prev) =>
      prev.map((epica) => {
        if (level === 'epica' && epica.id === id) return { ...epica, ...patch };
        return {
          ...epica,
          stories: epica.stories.map((story) => {
            if (level === 'story' && story.id === id) return { ...story, ...patch };
            return {
              ...story,
              tasks: story.tasks.map((task) => {
                if (level === 'task' && task.id === id) return { ...task, ...patch };
                return {
                  ...task,
                  subtasks: task.subtasks.map((subtask) =>
                    level === 'subtask' && subtask.id === id ? { ...subtask, ...patch } : subtask
                  ),
                };
              }),
            };
          }),
        };
      })
    );
  }, []);

  const handleToggleEstado = async (level, node) => {
    const estadoAnterior = node.estado;
    const nuevoEstado = nextEstado(estadoAnterior || 'pendiente');

    applyPatch(level, node.id, { estado: nuevoEstado });
    setUpdatingId(node.id);
    try {
      await PATCHERS[level](node.id, { estado: nuevoEstado });
    } catch (err) {
      applyPatch(level, node.id, { estado: estadoAnterior });
      notify(err.message || ERRORS.UPDATE_ESTADO, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const Header = (
    <div className="mb-6">
      <button onClick={() => navigate(routes.planes(ideaId))} className="ds-btn ds-btn-outline">
        <ArrowLeft size={16} strokeWidth={1.75} />
        Volver a versiones
      </button>
    </div>
  );

  if (loading) return <Spinner label="Cargando plan de trabajo..." />;
  if (error) {
    return (
      <div className="mx-auto max-w-[800px]">
        {Header}
        <ErrorMessage message={error} onRetry={loadPlan} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[800px]">
      {Header}

      {epicas.length === 0 ? (
        <p className="text-center font-body text-stone">Este plan todavía no tiene épicas.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {epicas.map((epica) => {
            const epicaExpanded = expandedEpicas.has(epica.id);
            return (
              <div key={epica.id} className={epicaCardClass}>
                <NodeHeader
                  titulo={epica.titulo}
                  node={epica}
                  level="epica"
                  expanded={epicaExpanded}
                  showCaret
                  onToggleExpand={() => toggleEpica(epica.id)}
                  onToggleEstado={() => handleToggleEstado('epica', epica)}
                  disabled={updatingId === epica.id}
                />

                {epicaExpanded && (
                  <div className="pb-2">
                    {epica.descripcion && <p className={descripcionClass}>{epica.descripcion}</p>}

                    {epica.stories.map((story) => {
                      const storyExpanded = expandedStories.has(story.id);
                      return (
                        <div key={story.id} className={storyCardClass}>
                          <NodeHeader
                            titulo={story.titulo}
                            node={story}
                            level="story"
                            expanded={storyExpanded}
                            showCaret
                            onToggleExpand={() => toggleStory(story.id)}
                            onToggleEstado={() => handleToggleEstado('story', story)}
                            disabled={updatingId === story.id}
                          />

                          {storyExpanded && (
                            <div className="pb-2">
                              {story.criterios_aceptacion && (
                                <p className={descripcionClass}>Criterios: {story.criterios_aceptacion}</p>
                              )}

                              {story.tasks.map((task) => {
                                const taskExpanded = expandedTasks.has(task.id);
                                return (
                                  <div key={task.id} className={taskCardClass}>
                                    <NodeHeader
                                      titulo={`${FRENTE_LABELS[task.frente] || task.frente}: ${task.titulo}`}
                                      node={task}
                                      level="task"
                                      expanded={taskExpanded}
                                      showCaret
                                      onToggleExpand={() => toggleTask(task.id)}
                                      onToggleEstado={() => handleToggleEstado('task', task)}
                                      disabled={updatingId === task.id}
                                    />

                                    {taskExpanded && (
                                      <div className="pb-1">
                                        {task.descripcion && (
                                          <p className={descripcionClass}>{task.descripcion}</p>
                                        )}

                                        {task.subtasks.map((subtask) => (
                                          <div key={subtask.id} className={subtaskRowClass}>
                                            <span className="font-body text-sm text-ink">
                                              {subtask.titulo}
                                            </span>
                                            {subtask.tiempo_estimado_min != null && (
                                              <span className={tiempoBadgeClass}>
                                                {subtask.tiempo_estimado_min} min
                                              </span>
                                            )}
                                            <EstadoPill
                                              estado={subtask.estado}
                                              onToggle={() => handleToggleEstado('subtask', subtask)}
                                              disabled={updatingId === subtask.id}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PlanDetail;
