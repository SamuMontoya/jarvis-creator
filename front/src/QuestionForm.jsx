import { useState, useEffect, useCallback } from 'react';
import QuestionHeader from './components/QuestionHeader';
import QuestionCard from './components/QuestionCard';
import Spinner from './components/Spinner';
import ErrorMessage from './components/ErrorMessage';
import { useApp } from './context/AppContext';
import { useToast } from './context/ToastContext';
import { api } from './api';
import { ERRORS, SUCCESS, MIN_ANSWER_LENGTH, STAGES } from './constants';

function QuestionForm({ editMode = false }) {
  const {
    ideaId,
    questionIndex,
    setQuestionIndex,
    setTotalQuestions,
    goToResumen,
    goToIdeas,
    finishEditing,
    editingReturnStage,
  } = useApp();
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
        goToResumen();
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
      <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
        <p>No hay preguntas disponibles.</p>
        <button onClick={goToIdeas} style={{ padding: '0.75rem 1.5rem', cursor: 'pointer' }}>
          Volver a mis ideas
        </button>
      </div>
    );
  }

  const nextDisabled = saving || !trimmed || isTooShort;
  const backLabel =
    editingReturnStage === STAGES.FINAL_RESUME ? 'Volver al resumen final' : 'Volver al resumen';

  return (
    <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '1rem' }}>
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
        style={{
          fontSize: '0.85rem',
          color: trimmed && isTooShort ? '#dc3545' : '#666',
          marginTop: '0.25rem',
        }}
      >
        {trimmed.length}/{MIN_ANSWER_LENGTH} caracteres mínimos
      </div>

      <div style={{ marginTop: '1rem' }}>
        <ErrorMessage message={error} />
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <button
          type="button"
          onClick={handlePrevious}
          disabled={saving || (!editMode && isFirstQuestion)}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: saving || (!editMode && isFirstQuestion) ? '#ccc' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving || (!editMode && isFirstQuestion) ? 'not-allowed' : 'pointer',
          }}
        >
          {editMode ? backLabel : 'Anterior'}
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={nextDisabled}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: nextDisabled ? '#ccc' : isLastQuestion ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: nextDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Guardando...' : editMode ? 'Guardar' : isLastQuestion ? 'Ir a Resumen' : 'Siguiente'}
        </button>
      </div>
    </div>
  );
}

export default QuestionForm;
