import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SeccionRespuestas from './components/SeccionRespuestas';
import Spinner from './components/Spinner';
import ErrorMessage from './components/ErrorMessage';
import { useApp } from './context/AppContext';
import { api } from './api';
import { QUESTION_TYPES, routes } from './constants';

function ResumenForm() {
  const { ideaId } = useParams();
  const navigate = useNavigate();
  const { editQuestion, setQuestionIndex, setDynamicQuestionIndex, totalQuestions } = useApp();

  const [idea, setIdea] = useState(null);
  const [respuestas, setRespuestas] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ideaData, questionsData, respuestasData] = await Promise.all([
        api.getIdea(ideaId),
        api.getQuestions(),
        api.getRespuestas(ideaId),
      ]);

      setIdea(ideaData.idea);
      setQuestions(questionsData.questions || []);
      setRespuestas(respuestasData.respuestas || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    load();
  }, [load]);

  const questionMap = useMemo(
    () => Object.fromEntries(questions.map((q) => [q.id, q.pregunta])),
    [questions]
  );

  const resolveQuestion = useCallback(
    (resp, idx) => questionMap[resp.generic_question_id] ?? `Pregunta ${idx + 1}`,
    [questionMap]
  );

  const handleEdit = useCallback(
    (index) => editQuestion(ideaId, QUESTION_TYPES.GENERIC, index, routes.resumen(ideaId)),
    [editQuestion, ideaId]
  );

  const handleBackToQuestions = useCallback(() => {
    setQuestionIndex(Math.max(0, totalQuestions - 1));
    navigate(routes.preguntas(ideaId));
  }, [setQuestionIndex, totalQuestions, navigate, ideaId]);

  const handleStartDynamic = useCallback(() => {
    setDynamicQuestionIndex(0);
    navigate(routes.analisis(ideaId));
  }, [setDynamicQuestionIndex, navigate, ideaId]);

  if (loading) return <Spinner label="Cargando resumen..." />;

  if (error) return <ErrorMessage message={error} onRetry={load} />;

  if (!idea) return <ErrorMessage message="No se encontró la idea." onRetry={load} />;

  return (
    <div className="mx-auto max-w-[700px]">
      <h2 className="mb-6 text-center font-display text-2xl font-bold text-ink">
        Resumen de tu idea
      </h2>

      <div className="mb-6 border-l-2 border-amber bg-paper-warm px-4 py-4">
        <h3 className="ds-label mb-1 mt-0">{idea.titulo || 'Tu idea'}</h3>
        <p className="m-0 whitespace-pre-wrap font-body text-ink">{idea.texto_idea}</p>
      </div>

      <SeccionRespuestas
        title="Definición (Descubrimiento Inicial)"
        respuestas={respuestas}
        emptyLabel="Todavía no has respondido ninguna pregunta."
        resolveQuestion={resolveQuestion}
        onEdit={handleEdit}
      />

      <p className="text-center font-body text-sm text-stone">
        Toca cualquier respuesta para editarla.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <button onClick={handleBackToQuestions} className="ds-btn ds-btn-outline">
          Volver a las preguntas
        </button>
        <button onClick={handleStartDynamic} className="ds-btn ds-btn-amber">
          Continuar al análisis profundo
        </button>
      </div>
    </div>
  );
}

export default ResumenForm;
