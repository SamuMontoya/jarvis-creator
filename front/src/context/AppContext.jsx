import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { QUESTION_TYPES, routes } from '../constants';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const navigate = useNavigate();

  const [ideaText, setIdeaText] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [dynamicQuestionIndex, setDynamicQuestionIndex] = useState(0);
  const [editingQuestionType, setEditingQuestionType] = useState(null);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  const [editingReturnPath, setEditingReturnPath] = useState(null);
  const [totalQuestions, setTotalQuestions] = useState(0);

  // Opens a question in edit mode from a summary screen, remembering where
  // to return to (the summary can be reached from more than one place).
  const editQuestion = useCallback(
    (ideaId, type, index, returnPath) => {
      setEditingReturnPath(returnPath);
      setEditingQuestionType(type);
      setEditingQuestionIndex(index);
      if (type === QUESTION_TYPES.GENERIC) {
        setQuestionIndex(index);
        navigate(`${routes.preguntas(ideaId)}?editar=1`);
      } else {
        setDynamicQuestionIndex(index);
        navigate(`${routes.analisis(ideaId)}?editar=1`);
      }
    },
    [navigate]
  );

  const finishEditing = useCallback(() => {
    if (editingReturnPath) navigate(editingReturnPath);
    setEditingQuestionType(null);
    setEditingQuestionIndex(null);
    setEditingReturnPath(null);
  }, [editingReturnPath, navigate]);

  const value = useMemo(
    () => ({
      ideaText,
      questionIndex,
      dynamicQuestionIndex,
      editingQuestionType,
      editingQuestionIndex,
      editingReturnPath,
      totalQuestions,
      setIdeaText,
      setQuestionIndex,
      setDynamicQuestionIndex,
      setTotalQuestions,
      editQuestion,
      finishEditing,
    }),
    [
      ideaText,
      questionIndex,
      dynamicQuestionIndex,
      editingQuestionType,
      editingQuestionIndex,
      editingReturnPath,
      totalQuestions,
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
