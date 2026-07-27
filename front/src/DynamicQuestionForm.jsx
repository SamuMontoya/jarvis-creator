import { useState, useEffect, useCallback } from 'react';
import QuestionHeader from './components/QuestionHeader';
import QuestionCard from './components/QuestionCard';
import Spinner from './components/Spinner';
import ErrorMessage from './components/ErrorMessage';
import { useApp } from './context/AppContext';
import { useToast } from './context/ToastContext';
import { api } from './api';
import { ERRORS, SUCCESS, MIN_ANSWER_LENGTH } from './constants';

function DynamicQuestionForm({ editMode = false }) {
  const {
    ideaId,
    dynamicQuestionIndex,
    setDynamicQuestionIndex,
    goToFinalResume,
    goToResumen,
    finishEditing,
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
        goToFinalResume();
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
      goToResumen();
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
      <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
        <p>{ERRORS.LOAD_DYNAMIC_QUESTIONS}</p>
        <button onClick={load} style={{ padding: '0.75rem 1.5rem', cursor: 'pointer' }}>
          Reintentar
        </button>
      </div>
    );
  }

  const nextDisabled = saving || !trimmed || isTooShort;

  return (
    <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '1rem' }}>
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
          disabled={saving}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: saving ? '#ccc' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {editMode ? 'Volver al resumen final' : 'Anterior'}
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
