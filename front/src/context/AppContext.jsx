import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { STAGES, QUESTION_TYPES, IDEA_STATES } from '../constants';

const AppContext = createContext(null);

const SESSION_KEY = 'jarvis_session';

// Only stages that represent recoverable in-flight progress. Restoring an edit
// stage would drop the user into a form with no summary to return to.
const RESUMABLE_STAGES = [
  STAGES.QUESTIONS,
  STAGES.RESUMEN,
  STAGES.DYNAMIC_QUESTIONS,
  STAGES.FINAL_RESUME,
];

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.ideaId || !RESUMABLE_STAGES.includes(session.stage)) return null;
    return session;
  } catch {
    return null;
  }
}

export function AppProvider({ children }) {
  const restored = readSession();

  const [stage, setStage] = useState(restored?.stage ?? STAGES.IDEAS);
  const [ideaId, setIdeaId] = useState(restored?.ideaId ?? null);
  const [ideaText, setIdeaText] = useState('');
  const [questionIndex, setQuestionIndex] = useState(restored?.questionIndex ?? 0);
  const [dynamicQuestionIndex, setDynamicQuestionIndex] = useState(
    restored?.dynamicQuestionIndex ?? 0
  );
  const [editingQuestionType, setEditingQuestionType] = useState(null);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  const [editingReturnStage, setEditingReturnStage] = useState(null);
  const [totalQuestions, setTotalQuestions] = useState(0);

  useEffect(() => {
    try {
      if (ideaId && RESUMABLE_STAGES.includes(stage)) {
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ ideaId, stage, questionIndex, dynamicQuestionIndex })
        );
      } else if (!ideaId) {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // Storage unavailable (private mode, quota). Progress recovery is a
      // convenience, never a hard requirement.
    }
  }, [ideaId, stage, questionIndex, dynamicQuestionIndex]);

  const goToIdeas = useCallback(() => {
    setStage(STAGES.IDEAS);
    setIdeaId(null);
    setIdeaText('');
    setQuestionIndex(0);
    setDynamicQuestionIndex(0);
  }, []);

  const goToNewIdea = useCallback(() => setStage(STAGES.IDEA), []);

  const startQuestions = useCallback((id) => {
    setIdeaId(id);
    setQuestionIndex(0);
    setStage(STAGES.QUESTIONS);
  }, []);

  const continueIdea = useCallback((idea) => {
    setIdeaId(idea.id);
    setIdeaText(idea.texto_idea || '');
    if (idea.estado === IDEA_STATES.REFINED) {
      setStage(STAGES.FINAL_RESUME);
    } else {
      setQuestionIndex(0);
      setStage(STAGES.QUESTIONS);
    }
  }, []);

  const goToResumen = useCallback(() => setStage(STAGES.RESUMEN), []);

  const goToFinalResume = useCallback(() => setStage(STAGES.FINAL_RESUME), []);

  const startDynamicQuestions = useCallback(() => {
    setDynamicQuestionIndex(0);
    setStage(STAGES.DYNAMIC_QUESTIONS);
  }, []);

  const backToLastQuestion = useCallback(() => {
    setQuestionIndex(Math.max(0, totalQuestions - 1));
    setStage(STAGES.QUESTIONS);
  }, [totalQuestions]);

  const editQuestion = useCallback(
    (type, index) => {
      // Remember the screen the edit was opened from (Resumen or Resumen
      // Final) so finishEditing can return there, instead of guessing from
      // the question type alone — a generic-question edit can be opened
      // from either summary screen.
      setEditingReturnStage(stage);
      setEditingQuestionType(type);
      setEditingQuestionIndex(index);
      if (type === QUESTION_TYPES.GENERIC) {
        setQuestionIndex(index);
        setStage(STAGES.QUESTIONS_EDIT);
      } else {
        setDynamicQuestionIndex(index);
        setStage(STAGES.DYNAMIC_QUESTIONS_EDIT);
      }
    },
    [stage]
  );

  const finishEditing = useCallback(() => {
    setStage(
      editingReturnStage ??
        (editingQuestionType === QUESTION_TYPES.GENERIC ? STAGES.RESUMEN : STAGES.FINAL_RESUME)
    );
    setEditingQuestionType(null);
    setEditingQuestionIndex(null);
    setEditingReturnStage(null);
  }, [editingQuestionType, editingReturnStage]);

  const value = useMemo(
    () => ({
      stage,
      ideaId,
      ideaText,
      questionIndex,
      dynamicQuestionIndex,
      editingQuestionType,
      editingQuestionIndex,
      editingReturnStage,
      totalQuestions,
      setIdeaText,
      setQuestionIndex,
      setDynamicQuestionIndex,
      setTotalQuestions,
      goToIdeas,
      goToNewIdea,
      startQuestions,
      continueIdea,
      goToResumen,
      goToFinalResume,
      startDynamicQuestions,
      backToLastQuestion,
      editQuestion,
      finishEditing,
    }),
    [
      stage,
      ideaId,
      ideaText,
      questionIndex,
      dynamicQuestionIndex,
      editingQuestionType,
      editingQuestionIndex,
      editingReturnStage,
      totalQuestions,
      goToIdeas,
      goToNewIdea,
      startQuestions,
      continueIdea,
      goToResumen,
      goToFinalResume,
      startDynamicQuestions,
      backToLastQuestion,
      editQuestion,
      finishEditing,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp debe usarse dentro de <AppProvider>');
  }
  return context;
}
