import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import QuestionHeader from './components/QuestionHeader';
import QuestionCard from './components/QuestionCard';
import Spinner from './components/Spinner';
import ErrorMessage from './components/ErrorMessage';
import { useApp } from './context/AppContext';
import { useToast } from './context/ToastContext';
import { api } from './api';
import { ERRORS, SUCCESS, MIN_ANSWER_LENGTH, routes } from './constants';

function DynamicQuestionForm() {
  const { ideaId } = useParams();
  const [searchParams] = useSearchParams();
  const editMode = searchParams.get('editar') === '1';
  const navigate = useNavigate();
  const { dynamicQuestionIndex, setDynamicQuestionIndex, finishEditing } = useApp();
  const { notify } = useToast();

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [respuesta, setRespuesta] = useState('');
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [questionsError, setQuestionsError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoadingQuestions(true);
    setQuestionsError(null);
    try {
      let data = await api.getDynamicQuestions(ideaId);

      // First visit: Groq has not produced the deep-dive questions yet.
      if (!data.dynamic_questions?.length) {
        data = await api.generateDynamicQuestions(ideaId);
      }

      setQuestions(data.dynamic_questions || []);

      const respuestasData = await api.getDynamicRespuestas(ideaId);
      const byQuestion = {};
      (respuestasData.dynamic_respuestas || []).forEach((r) => {
        byQuestion[r.dynamic_question_id] = r.respuesta;
      });
      setAnswers(byQuestion);
    } catch (err) {
      setQuestionsError(err.message);
    } finally {
      setLoadingQuestions(false);
    }
  }, [ideaId]);

  useEffect(() => {
    load();
  }, [load]);

  const currentQuestion = questions[dynamicQuestionIndex];

  useEffect(() => {
    setRespuesta(currentQuestion ? answers[currentQuestion.id] ?? '' : '');
    setError(null);
  }, [currentQuestion, answers]);

  const trimmed = respuesta.trim();
  const isTooShort = trimmed.length < MIN_ANSWER_LENGTH;
  const isFirstQuestion = dynamicQuestionIndex === 0;
  const isLastQuestion = dynamicQuestionIndex === questions.length - 1;

  const handleNext = async () => {
    setError(null);

    if (!trimmed) return setError(ERRORS.ANSWER_EMPTY);
    if (isTooShort) return setError(ERRORS.ANSWER_TOO_SHORT);

    setSaving(true);
    try {
      await api.saveDynamicRespuesta({
        idea_id: ideaId,
        dynamic_question_id: currentQuestion.id,
        respuesta: trimmed,
      });
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: trimmed }));
      notify(SUCCESS.ANSWER_SAVED);

      if (editMode) {
        finishEditing();
      } else if (isLastQuestion) {
        navigate(routes.idea(ideaId));
      } else {
        setDynamicQuestionIndex(dynamicQuestionIndex + 1);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrevious = () => {
    if (editMode) {
      finishEditing();
    } else if (isFirstQuestion) {
      navigate(routes.resumen(ideaId));
    } else {
      setDynamicQuestionIndex(dynamicQuestionIndex - 1);
    }
  };

  if (loadingQuestions) {
    return <Spinner label="Generando tu análisis profundo con IA..." />;
  }

  if (questionsError) {
    return <ErrorMessage message={questionsError} onRetry={load} />;
  }

  if (questions.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-stone">
        <p className="font-body">{ERRORS.LOAD_DYNAMIC_QUESTIONS}</p>
        <button onClick={load} className="ds-btn ds-btn-outline mt-3">
          Reintentar
        </button>
      </div>
    );
  }

  const nextDisabled = saving || !trimmed || isTooShort;

  return (
    <div className="mx-auto max-w-[700px]">
      <QuestionHeader
        currentIndex={dynamicQuestionIndex}
        total={questions.length}
        title="Análisis Profundo"
      />

      <QuestionCard
        question={currentQuestion?.pregunta}
        value={respuesta}
        onChange={(e) => setRespuesta(e.target.value)}
        disabled={saving}
      />

      <div
        className="mt-1 font-body text-xs"
        style={{ color: trimmed && isTooShort ? 'var(--color-danger)' : 'var(--color-stone)' }}
      >
        {trimmed.length}/{MIN_ANSWER_LENGTH} caracteres mínimos
      </div>

      <div className="mt-4">
        <ErrorMessage message={error} />
      </div>

      <div className="mt-4 flex gap-4">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={saving}
          className="ds-btn ds-btn-outline flex-1"
        >
          {editMode ? 'Volver al resumen final' : 'Anterior'}
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={nextDisabled}
          className={`ds-btn flex-1 ${isLastQuestion ? 'ds-btn-ink' : 'ds-btn-amber'}`}
        >
          {saving
            ? 'Guardando...'
            : editMode
              ? 'Guardar'
              : isLastQuestion
                ? 'Ver resumen final'
                : 'Siguiente'}
        </button>
      </div>
    </div>
  );
}

export default DynamicQuestionForm;
