import { useState, useEffect } from 'react';
import IdeaForm from './IdeaForm';
import QuestionForm from './QuestionForm';
import ResumenForm from './ResumenForm';
import './App.css';

function App() {
  const [stage, setStage] = useState('idea');
  const [ideaId, setIdeaId] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState([]);

  // Fetch questions on mount for navigation
  useEffect(() => {
    fetch('http://localhost:3001/api/questions')
      .then(r => r.json())
      .then(data => {
        if (data.questions) setQuestions(data.questions);
      });
  }, []);

  const handleIdeaCreated = (id) => {
    setIdeaId(id);
    setStage('questions');
    setCurrentQuestionIndex(0);
  };

  const handleNext = () => {
    setCurrentQuestionIndex(prev => prev + 1);
  };

  const handlePrevious = () => {
    setCurrentQuestionIndex(prev => Math.max(0, prev - 1));
  };

  const handleQuestionsComplete = () => {
    setStage('resumen');
  };

  const handleRestart = () => {
    setStage('idea');
    setIdeaId(null);
    setCurrentQuestionIndex(0);
  };

  const handleEditQuestion = (index) => {
    setCurrentQuestionIndex(index);
    setStage('questions-edit');
  };

  const handleEditComplete = (action) => {
    if (action === 'back') {
      setStage('resumen');
    } else {
      // action is the next index after saving
      setCurrentQuestionIndex(action);
      setStage('resumen');
    }
  };

  const handleBackFromResumen = () => {
    setStage('questions');
    setCurrentQuestionIndex(questions.length > 0 ? questions.length - 1 : 0);
  };

  if (stage === 'idea') {
    return (
      <>
        <section id="center">
          <div className="hero">
            <h1>JARVIS Creator</h1>
          </div>
        </section>
        <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
          <IdeaForm onIdeaCreated={handleIdeaCreated} />
        </main>
      </>
    );
  }

  const isEditMode = stage === 'questions-edit';

  if (stage === 'questions' || isEditMode) {
    return (
      <>
        <section id="center">
          <div className="hero">
            <h1>{isEditMode ? 'JARVIS Creator - Editando pregunta' : 'JARVIS Creator - Preguntas'}</h1>
          </div>
        </section>
        <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
          <QuestionForm
            idea_id={ideaId}
            currentQuestionIndex={currentQuestionIndex}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onComplete={handleQuestionsComplete}
            editMode={isEditMode}
            onEditComplete={handleEditComplete}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <section id="center">
        <div className="hero">
          <h1>JARVIS Creator - Resumen</h1>
        </div>
      </section>
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
        <ResumenForm
          idea_id={ideaId}
          onComplete={handleRestart}
          onBack={handleBackFromResumen}
          onEditQuestion={handleEditQuestion}
        />
      </main>
    </>
  );
}

export default App;