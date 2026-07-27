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

function QuestionForm() {
  const { ideaId } = useParams();
  const [searchParams] = useSearchParams();
  const editMode = searchParams.get('editar') === '1';
  const navigate = useNavigate();
  const { questionIndex, setQuestionIndex, setTotalQuestions, finishEditing, editingReturnPath } =
    useApp();
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
      const [questionsData, respuestasData] = await Promise.all([
        api.getQuestions(),
        api.getRespuestas(ideaId),
      ]);

      const loaded = questionsData.questions || [];
      setQuestions(loaded);
      setTotalQuestions(loaded.length);

      const byQuestion = {};
      (respuestasData.respuestas || []).forEach((r) => {
        byQuestion[r.generic_question_id] = r.respuesta;
      });
      setAnswers(byQuestion);
    } catch (err) {
      setQuestionsError(err.message);
    } finally {
      setLoadingQuestions(false);
    }
  }, [ideaId, setTotalQuestions]);

  useEffect(() => {
    load();
  }, [load]);

  const currentQuestion = questions[questionIndex];

  // Show the stored answer when revisiting or editing a question.
  useEffect(() => {
    setRespuesta(currentQuestion ? answers[currentQuestion.id] ?? '' : '');
    setError(null);
  }, [currentQuestion, answers]);

  const trimmed = respuesta.trim();
  const isTooShort = trimmed.length < MIN_ANSWER_LENGTH;
  const isFirstQuestion = questionIndex === 0;
  const isLastQuestion = questionIndex === questions.length - 1;

  const handleNext = async () => {
    setError(null);

    if (!trimmed) return setError(ERRORS.ANSWER_EMPTY);
    if (isTooShort) return setError(ERRORS.ANSWER_TOO_SHORT);

    setSaving(true);
    try {
      await api.saveRespuesta({
        idea_id: ideaId,
        generic_question_id: currentQuestion.id,
        respuesta: trimmed,
      });
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: trimmed }));
      notify(SUCCESS.ANSWER_SAVED);

      if (editMode) {
        finishEditing();
      } else if (isLastQuestion) {
        navigate(routes.resumen(ideaId));
      } else {
        setQuestionIndex(questionIndex + 1);
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
    } else if (!isFirstQuestion) {
      setQuestionIndex(questionIndex - 1);
    }
  };

  if (loadingQuestions) return <Spinner label="Cargando preguntas..." />;

  if (questionsError) {
    return <ErrorMessage message={questionsError} onRetry={load} />;
  }

  if (questions.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-stone">
        <p className="font-body">No hay preguntas disponibles.</p>
        <button onClick={() => navigate(routes.home())} className="ds-btn ds-btn-outline mt-3">
          Volver a mis ideas
        </button>
      </div>
    );
  }

  const nextDisabled = saving || !trimmed || isTooShort;
  const backLabel = editingReturnPath === routes.idea(ideaId) ? 'Volver a la idea' : 'Volver al resumen';

  return (
    <div className="mx-auto max-w-[700px]">
      <QuestionHeader
        currentIndex={questionIndex}
        total={questions.length}
        title="Descubrimiento Inicial"
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
          disabled={saving || (!editMode && isFirstQuestion)}
          className="ds-btn ds-btn-outline flex-1"
        >
          {editMode ? backLabel : 'Anterior'}
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={nextDisabled}
          className={`ds-btn flex-1 ${isLastQuestion ? 'ds-btn-ink' : 'ds-btn-amber'}`}
        >
          {saving ? 'Guardando...' : editMode ? 'Guardar' : isLastQuestion ? 'Ir a Resumen' : 'Siguiente'}
        </button>
      </div>
    </div>
  );
}

export default QuestionForm;
