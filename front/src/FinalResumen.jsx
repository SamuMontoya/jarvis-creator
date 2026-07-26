import { useState, useEffect, useCallback, useMemo } from 'react';
import SeccionRespuestas from './components/SeccionRespuestas';
import BotonesDescarga from './components/BotonesDescarga';
import Spinner from './components/Spinner';
import ErrorMessage from './components/ErrorMessage';
import { useApp } from './context/AppContext';
import { useToast } from './context/ToastContext';
import { api } from './api';
import { SUCCESS, IDEA_STATES, QUESTION_TYPES } from './constants';
import { markdownToPdf } from './markdownToPdf';

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

function FinalResumen() {
  const { ideaId, editQuestion, startDynamicQuestions, goToIdeas } = useApp();
  const { notify } = useToast();

  const [idea, setIdea] = useState(null);
  const [genericQuestions, setGenericQuestions] = useState([]);
  const [genericRespuestas, setGenericRespuestas] = useState([]);
  const [dynamicRespuestas, setDynamicRespuestas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ideaData, questionsData, genRespData, dynRespData] = await Promise.all([
        api.getIdea(ideaId),
        api.getQuestions(),
        api.getRespuestas(ideaId),
        api.getDynamicRespuestas(ideaId),
      ]);

      setIdea(ideaData.idea);
      setGenericQuestions(questionsData.questions || []);
      setGenericRespuestas(genRespData.respuestas || []);
      setDynamicRespuestas(dynRespData.dynamic_respuestas || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    load();
  }, [load]);

  const fileStem = `jarvis-idea-${String(ideaId).slice(0, 8)}`;

  const runDownload = useCallback(
    async (task) => {
      setBusy(true);
      try {
        await task();
        notify(SUCCESS.DOCUMENT_READY);
      } catch (err) {
        notify(err.message, 'error');
      } finally {
        setBusy(false);
      }
    },
    [notify]
  );

  const handleDownloadHTML = useCallback(
    () =>
      runDownload(async () => {
        const { html } = await api.generateHtml(ideaId);
        downloadBlob(html, 'text/html', `${fileStem}.html`);
      }),
    [runDownload, ideaId, fileStem]
  );

  const handleDownloadMarkdown = useCallback(
    () =>
      runDownload(async () => {
        const { markdown } = await api.generateMarkdown(ideaId);
        downloadBlob(markdown, 'text/markdown', `${fileStem}.md`);
      }),
    [runDownload, ideaId, fileStem]
  );

  const handleDownloadPDF = useCallback(
    () =>
      runDownload(async () => {
        const { markdown } = await api.generateMarkdownSource(ideaId);
        const doc = await markdownToPdf(markdown);
        doc.save(`${fileStem}.pdf`);
      }),
    [runDownload, ideaId, fileStem]
  );

  const handleFinish = useCallback(async () => {
    setFinishing(true);
    try {
      await api.updateIdeaState(ideaId, IDEA_STATES.REFINED);
      notify(SUCCESS.IDEA_COMPLETED);
      goToIdeas();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setFinishing(false);
    }
  }, [ideaId, notify, goToIdeas]);

  const questionMap = useMemo(
    () => Object.fromEntries(genericQuestions.map((q) => [q.id, q.pregunta])),
    [genericQuestions]
  );

  const resolveGenericQuestion = useCallback(
    (resp, idx) => questionMap[resp.generic_question_id] ?? `Pregunta ${idx + 1}`,
    [questionMap]
  );

  const resolveDynamicQuestion = useCallback(
    (resp, idx) => resp.pregunta ?? `Pregunta ${idx + 1}`,
    []
  );

  const handleEditGeneric = useCallback(
    (index) => editQuestion(QUESTION_TYPES.GENERIC, index),
    [editQuestion]
  );

  const handleEditDynamic = useCallback(
    (index) => editQuestion(QUESTION_TYPES.DYNAMIC, index),
    [editQuestion]
  );

  if (loading) return <Spinner label="Cargando resumen final..." />;

  if (error) return <ErrorMessage message={error} onRetry={load} />;

  if (!idea) return <ErrorMessage message="No se encontró la idea." onRetry={load} />;

  return (
    <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '1rem' }}>
      <h1 style={{ color: '#2c3e50', textAlign: 'center', marginBottom: '2rem' }}>
        Resumen Final Completo
      </h1>

      <div
        style={{
          marginBottom: '2rem',
          padding: '1.5rem',
          backgroundColor: '#e8f5e9',
          borderRadius: '8px',
          border: '1px solid #c8e6c9',
        }}
      >
        <h2 style={{ color: '#2e7d32', marginTop: 0 }}>Idea Original</h2>
        <p style={{ whiteSpace: 'pre-wrap', fontSize: '1.1rem', color: '#1b5e20', margin: 0 }}>
          {idea.texto_idea}
        </p>
      </div>

      <SeccionRespuestas
        title="Definición (Descubrimiento Inicial)"
        respuestas={genericRespuestas}
        emptyLabel="No hay respuestas del descubrimiento inicial registradas."
        resolveQuestion={resolveGenericQuestion}
        onEdit={handleEditGeneric}
      />

      <SeccionRespuestas
        title="Análisis Profundo"
        respuestas={dynamicRespuestas}
        emptyLabel="No hay respuestas del análisis profundo registradas."
        resolveQuestion={resolveDynamicQuestion}
        onEdit={handleEditDynamic}
      />

      <BotonesDescarga
        onBack={startDynamicQuestions}
        onDownloadHTML={handleDownloadHTML}
        onDownloadMarkdown={handleDownloadMarkdown}
        onDownloadPDF={handleDownloadPDF}
        loading={busy}
      />

      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <button
          onClick={handleFinish}
          disabled={finishing}
          style={{
            padding: '1rem 2.5rem',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            backgroundColor: finishing ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: finishing ? 'not-allowed' : 'pointer',
          }}
        >
          {finishing ? 'Guardando...' : 'Finalizar idea'}
        </button>
      </div>
    </div>
  );
}

export default FinalResumen;
