import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, ListTree, Sparkles } from 'lucide-react';
import SeccionRespuestas from './components/SeccionRespuestas';
import Spinner from './components/Spinner';
import ErrorMessage from './components/ErrorMessage';
import { useApp } from './context/AppContext';
import { useToast } from './context/ToastContext';
import { api } from './api';
import { SUCCESS, IDEA_STATES, QUESTION_TYPES, routes } from './constants';

function downloadBlob(content, mimeType, filename) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function IdeaDetail() {
  const { ideaId } = useParams();
  const navigate = useNavigate();
  const { editQuestion } = useApp();
  const { notify } = useToast();

  const [idea, setIdea] = useState(null);
  const [genericQuestions, setGenericQuestions] = useState([]);
  const [genericRespuestas, setGenericRespuestas] = useState([]);
  const [dynamicRespuestas, setDynamicRespuestas] = useState([]);
  const [hasPlan, setHasPlan] = useState(false);
  const [activeTab, setActiveTab] = useState('generales');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ideaData, questionsData, genRespData, dynRespData, planData] = await Promise.all([
        api.getIdea(ideaId),
        api.getQuestions(),
        api.getRespuestas(ideaId),
        api.getDynamicRespuestas(ideaId),
        api.getPlanForIdea(ideaId),
      ]);

      setIdea(ideaData.idea);
      setGenericQuestions(questionsData.questions || []);
      setGenericRespuestas(genRespData.respuestas || []);
      setDynamicRespuestas(dynRespData.dynamic_respuestas || []);
      setHasPlan(Boolean(planData.plan_id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    load();
  }, [load]);

  const fileStem = `kreanding-idea-${String(ideaId).slice(0, 8)}`;

  const handleDownloadMarkdown = useCallback(async () => {
    setBusy(true);
    try {
      const { markdown } = await api.generateMarkdown(ideaId);
      downloadBlob(markdown, 'text/markdown', `${fileStem}.md`);
      notify(SUCCESS.DOCUMENT_READY);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }, [ideaId, fileStem, notify]);

  const handleGeneratePlan = useCallback(async () => {
    setGeneratingPlan(true);
    try {
      await api.generatePlan(ideaId);
      setHasPlan(true);
      notify(SUCCESS.PLAN_READY);
      navigate(routes.planes(ideaId));
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setGeneratingPlan(false);
    }
  }, [ideaId, notify, navigate]);

  const handleFinish = useCallback(async () => {
    setFinishing(true);
    try {
      await api.updateIdeaState(ideaId, IDEA_STATES.REFINED);
      notify(SUCCESS.IDEA_COMPLETED);
      setIdea((prev) => (prev ? { ...prev, estado: IDEA_STATES.REFINED } : prev));
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setFinishing(false);
    }
  }, [ideaId, notify]);

  const questionMap = useMemo(
    () => Object.fromEntries(genericQuestions.map((q) => [q.id, q.pregunta])),
    [genericQuestions]
  );

  const resolveGenericQuestion = useCallback(
    (resp, idx) => questionMap[resp.generic_question_id] ?? `Pregunta ${idx + 1}`,
    [questionMap]
  );

  const resolveDynamicQuestion = useCallback((resp, idx) => resp.pregunta ?? `Pregunta ${idx + 1}`, []);

  const handleEditGeneric = useCallback(
    (index) => editQuestion(ideaId, QUESTION_TYPES.GENERIC, index, routes.idea(ideaId)),
    [editQuestion, ideaId]
  );

  const handleEditDynamic = useCallback(
    (index) => editQuestion(ideaId, QUESTION_TYPES.DYNAMIC, index, routes.idea(ideaId)),
    [editQuestion, ideaId]
  );

  if (loading) return <Spinner label="Cargando idea..." />;

  if (error) return <ErrorMessage message={error} onRetry={load} />;

  if (!idea) return <ErrorMessage message="No se encontró la idea." onRetry={load} />;

  const isRefined = idea.estado === IDEA_STATES.REFINED;

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => navigate(routes.home())} className="ds-btn ds-btn-outline">
          <ArrowLeft size={16} strokeWidth={1.75} />
          Volver a ideas
        </button>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={hasPlan ? () => navigate(routes.planes(ideaId)) : handleGeneratePlan}
            disabled={generatingPlan}
            className="ds-btn ds-btn-ink"
          >
            {hasPlan ? <ListTree size={16} strokeWidth={1.75} /> : <Sparkles size={16} strokeWidth={1.75} />}
            {generatingPlan ? 'Generando plan...' : hasPlan ? 'Ver planes' : 'Generar plan'}
          </button>
          <button onClick={handleDownloadMarkdown} disabled={busy} className="ds-btn ds-btn-amber">
            <Download size={16} strokeWidth={1.75} />
            {busy ? 'Generando...' : 'Descargar Markdown'}
          </button>
        </div>
      </div>

      <span className="ds-eyebrow">Idea</span>
      <h1 className="m-0 mt-1 font-display text-3xl font-bold text-ink">{idea.titulo}</h1>
      <p className="mt-3 whitespace-pre-wrap font-body text-stone">{idea.texto_idea}</p>

      <div className="mt-8 flex gap-6 border-b border-dust">
        {[
          { key: 'generales', label: 'Descubrimiento inicial' },
          { key: 'especificas', label: 'Análisis profundo' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="ds-label border-b-2 pb-2 transition-colors"
            style={{
              color: activeTab === tab.key ? 'var(--color-ink)' : 'var(--color-stone)',
              borderColor: activeTab === tab.key ? 'var(--color-amber)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4 max-h-[480px] overflow-y-auto pr-1">
        {activeTab === 'generales' ? (
          <SeccionRespuestas
            title="Definición (Descubrimiento Inicial)"
            respuestas={genericRespuestas}
            emptyLabel="No hay respuestas del descubrimiento inicial registradas."
            resolveQuestion={resolveGenericQuestion}
            onEdit={handleEditGeneric}
          />
        ) : (
          <SeccionRespuestas
            title="Análisis Profundo"
            respuestas={dynamicRespuestas}
            emptyLabel="No hay respuestas del análisis profundo registradas."
            resolveQuestion={resolveDynamicQuestion}
            onEdit={handleEditDynamic}
          />
        )}
      </div>

      {!isRefined && (
        <div className="mt-8 text-center">
          <button
            onClick={handleFinish}
            disabled={finishing}
            className="ds-btn ds-btn-ink !px-10 !py-4 !text-base"
          >
            {finishing ? 'Guardando...' : 'Finalizar idea'}
          </button>
        </div>
      )}
    </div>
  );
}

export default IdeaDetail;
