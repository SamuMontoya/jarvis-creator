import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import Spinner from './Spinner';
import ErrorMessage from './ErrorMessage';
import { ERRORS } from '../constants';

const ESTADOS = ['pendiente', 'en_progreso', 'completada'];

const ESTADO_STYLES = {
  pendiente: { backgroundColor: '#e9ecef', color: '#495057', label: 'Pendiente' },
  en_progreso: { backgroundColor: '#ffc107', color: '#333', label: 'En progreso' },
  completada: { backgroundColor: '#28a745', color: 'white', label: 'Completada' },
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

function EstadoCheckbox({ estado, onToggle, disabled }) {
  const style = ESTADO_STYLES[estado] || ESTADO_STYLES.pendiente;
  return (
    <button
      type="button"
      title={style.label}
      aria-label={style.label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      style={{
        width: '20px',
        height: '20px',
        minWidth: '20px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        backgroundColor: style.backgroundColor,
        color: style.color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.7rem',
        fontWeight: 'bold',
        lineHeight: 1,
        padding: 0,
        flexShrink: 0,
      }}
    >
      {estado === 'completada' ? '✓' : ''}
    </button>
  );
}

function NodeHeader({ titulo, estado, expanded, showCaret, onToggleExpand, onToggleEstado, disabled }) {
  return (
    <div
      onClick={onToggleExpand}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 0',
        cursor: onToggleExpand ? 'pointer' : 'default',
      }}
    >
      {showCaret && (
        <span style={{ width: '1rem', color: '#888', fontSize: '0.75rem', flexShrink: 0 }}>
          {expanded ? '▾' : '▸'}
        </span>
      )}
      <EstadoCheckbox estado={estado} onToggle={onToggleEstado} disabled={disabled} />
      <span>{titulo}</span>
    </div>
  );
}

const epicaCardStyle = {
  border: '1px solid #ddd',
  borderRadius: '8px',
  backgroundColor: '#fafafa',
  padding: '0.5rem 1rem',
};

const storyCardStyle = {
  borderLeft: '3px solid #007bff',
  paddingLeft: '1rem',
  marginTop: '0.5rem',
};

const taskCardStyle = {
  borderLeft: '3px solid #6c757d',
  paddingLeft: '1rem',
  marginTop: '0.4rem',
};

const subtaskRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.3rem 0 0.3rem 1rem',
};

const descripcionStyle = { color: '#666', fontSize: '0.85rem', margin: '0 0 0.5rem' };

const tiempoBadgeStyle = {
  marginLeft: 'auto',
  fontSize: '0.75rem',
  color: '#888',
  whiteSpace: 'nowrap',
};

function PlanView({ planId, ideaId }) {
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
      const { epicas: epicasData } = await api.getEpicas(planId);

      const epicasConHijos = await Promise.all(
        (epicasData || []).map(async (epica) => {
          const { stories: storiesData } = await api.getStories(epica.id);

          const storiesConHijos = await Promise.all(
            (storiesData || []).map(async (story) => {
              const { tasks: tasksData } = await api.getTasks(story.id);

              const tasksConHijos = await Promise.all(
                (tasksData || []).map(async (task) => {
                  const { subtasks: subtasksData } = await api.getSubtasks(task.id);
                  return { ...task, subtasks: subtasksData || [] };
                })
              );

              return { ...story, tasks: tasksConHijos };
            })
          );

          return { ...epica, stories: storiesConHijos };
        })
      );

      setEpicas(epicasConHijos);
    } catch (err) {
      setError(err.message || ERRORS.LOAD_PLAN);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    if (!planId) return;
    loadPlan();
  }, [planId, loadPlan]);

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

  if (loading) return <Spinner label="Cargando plan de trabajo..." />;
  if (error) return <ErrorMessage message={error} onRetry={loadPlan} />;

  if (epicas.length === 0) {
    return <p style={{ color: '#999', textAlign: 'center' }}>Este plan todavía no tiene épicas.</p>;
  }

  return (
    <div data-idea-id={ideaId} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {epicas.map((epica) => {
        const epicaExpanded = expandedEpicas.has(epica.id);
        return (
          <div key={epica.id} style={epicaCardStyle}>
            <NodeHeader
              titulo={epica.titulo}
              estado={epica.estado}
              expanded={epicaExpanded}
              showCaret
              onToggleExpand={() => toggleEpica(epica.id)}
              onToggleEstado={() => handleToggleEstado('epica', epica)}
              disabled={updatingId === epica.id}
            />

            {epicaExpanded && (
              <div style={{ paddingBottom: '0.5rem' }}>
                {epica.descripcion && <p style={descripcionStyle}>{epica.descripcion}</p>}

                {epica.stories.map((story) => {
                  const storyExpanded = expandedStories.has(story.id);
                  return (
                    <div key={story.id} style={storyCardStyle}>
                      <NodeHeader
                        titulo={story.titulo}
                        estado={story.estado}
                        expanded={storyExpanded}
                        showCaret
                        onToggleExpand={() => toggleStory(story.id)}
                        onToggleEstado={() => handleToggleEstado('story', story)}
                        disabled={updatingId === story.id}
                      />

                      {storyExpanded && (
                        <div style={{ paddingBottom: '0.5rem' }}>
                          {story.criterios_aceptacion && (
                            <p style={descripcionStyle}>Criterios: {story.criterios_aceptacion}</p>
                          )}

                          {story.tasks.map((task) => {
                            const taskExpanded = expandedTasks.has(task.id);
                            return (
                              <div key={task.id} style={taskCardStyle}>
                                <NodeHeader
                                  titulo={`${FRENTE_LABELS[task.frente] || task.frente}: ${task.titulo}`}
                                  estado={task.estado}
                                  expanded={taskExpanded}
                                  showCaret
                                  onToggleExpand={() => toggleTask(task.id)}
                                  onToggleEstado={() => handleToggleEstado('task', task)}
                                  disabled={updatingId === task.id}
                                />

                                {taskExpanded && (
                                  <div style={{ paddingBottom: '0.25rem' }}>
                                    {task.descripcion && (
                                      <p style={descripcionStyle}>{task.descripcion}</p>
                                    )}

                                    {task.subtasks.map((subtask) => (
                                      <div key={subtask.id} style={subtaskRowStyle}>
                                        <EstadoCheckbox
                                          estado={subtask.estado}
                                          onToggle={() => handleToggleEstado('subtask', subtask)}
                                          disabled={updatingId === subtask.id}
                                        />
                                        <span>{subtask.titulo}</span>
                                        {subtask.tiempo_estimado_min != null && (
                                          <span style={tiempoBadgeStyle}>
                                            {subtask.tiempo_estimado_min} min
                                          </span>
                                        )}
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
  );
}

export default PlanView;
