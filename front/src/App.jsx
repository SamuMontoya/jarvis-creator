import { useState, useEffect } from 'react';
import IdeaForm from './IdeaForm';
import QuestionForm from './QuestionForm';
import ResumenForm from './ResumenForm';
import DynamicQuestionForm from './DynamicQuestionForm';
import MyIdeas from './MyIdeas';
import './App.css';

function App() {
  const [stage, setStage] = useState('ideas');
  const [ideaId, setIdeaId] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [dynamicQuestionIndex, setDynamicQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [ideaText, setIdeaText] = useState('');

  // Fetch questions on mount for navigation
  useEffect(() => {
    fetch('http://localhost:3001/api/questions')
      .then(r => r.json())
      .then(data => {
        if (data.questions) setQuestions(data.questions);
      });
  }, []);

  // On mount, check localStorage for existing session
  useEffect(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('jarvis_respuestas_')) {
        const stored = JSON.parse(localStorage.getItem(key) || '{}');
        if (Object.keys(stored).length > 0) {
          const id = key.replace('jarvis_respuestas_', '');
          setIdeaId(id);
          setStage('questions');
          // Find last answered question index
          const answeredKeys = Object.keys(stored);
          if (questions.length > 0 && answeredKeys.length > 0) {
            const lastAnsweredQId = answeredKeys[answeredKeys.length - 1];
            const lastIndex = questions.findIndex(q => q.id === lastAnsweredQId);
            if (lastIndex !== -1) {
              // If last question is answered, go to next; otherwise go to that question
              if (answeredKeys.length === questions.length) {
                setCurrentQuestionIndex(questions.length - 1);
                setStage('resumen');
              } else {
                setCurrentQuestionIndex(lastIndex);
              }
            } else {
              setCurrentQuestionIndex(answeredKeys.length);
            }
          }
          // Fetch idea text
          fetch(`http://localhost:3001/api/ideas/${id}`)
            .then(r => r.json())
            .then(data => {
              if (data.idea?.texto_idea) setIdeaText(data.idea.texto_idea);
            });
          break;
        }
      }
    }
  }, [questions.length]);

  const handleIdeaCreated = (id) => {
    setIdeaId(id);
    setStage('questions');
    setCurrentQuestionIndex(0);
  };

  const handleNewIdea = () => {
    setStage('idea');
  };

  const handleContinueIdea = (idea) => {
    setIdeaId(idea.id);
    // If idea is completed, go to resumen; otherwise go to questions
    if (idea.estado === 'refined') {
      setStage('resumen');
    } else {
      setStage('questions');
      setCurrentQuestionIndex(0);
    }
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
    setStage('ideas');
    setIdeaId(null);
    setCurrentQuestionIndex(0);
    setIdeaText('');
  };

  const handleEditQuestion = (index) => {
    setCurrentQuestionIndex(index);
    setStage('questions-edit');
  };

  const handleEditComplete = (action) => {
    if (action === 'back') {
      setStage('resumen');
    } else {
      setCurrentQuestionIndex(action);
      setStage('resumen');
    }
  };

  const handleBackFromResumen = () => {
    setStage('questions');
    setCurrentQuestionIndex(questions.length > 0 ? questions.length - 1 : 0);
  };

  const handleStartDynamicQuestions = () => {
    setDynamicQuestionIndex(0);
    setStage('dynamic-questions');
  };

  const handleDynamicQuestionsComplete = () => {
    setStage('final-resume');
  };

  const renderHeader = () => (
    <section id="center">
      <div className="hero">
        <h1>JARVIS Creator</h1>
        {ideaText && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            backgroundColor: '#e8f5e9', 
            borderRadius: '8px',
            maxWidth: '600px',
            margin: '1rem auto 0',
            textAlign: 'center',
            fontSize: '1rem',
            color: '#2e7d32',
            fontWeight: 500,
            whiteSpace: 'pre-wrap',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {ideaText}
          </div>
        )}
      </div>
    </section>
  );

  if (stage === 'ideas') {
    return (
      <>
        {renderHeader()}
        <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
          <MyIdeas onNewIdea={handleNewIdea} onContinueIdea={handleContinueIdea} />
        </main>
      </>
    );
  }

  if (stage === 'idea') {
    return (
      <>
        {renderHeader()}
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
        {renderHeader()}
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

  if (stage === 'dynamic-questions') {
    return (
      <>
        {renderHeader()}
        <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
          <DynamicQuestionForm
            idea_id={ideaId}
            currentQuestionIndex={dynamicQuestionIndex}
            onNext={setDynamicQuestionIndex}
            onBack={setDynamicQuestionIndex}
            onComplete={handleDynamicQuestionsComplete}
            editMode={false}
          />
        </main>
      </>
    );
  }

  if (stage === 'final-resume') {
    return (
      <>
        {renderHeader()}
        <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
          <ResumenForm
            idea_id={ideaId}
            onComplete={handleRestart}
            onBack={handleStartDynamicQuestions}
            onEditQuestion={handleEditQuestion}
          />
        </main>
      </>
    );
  }

  return (
    <>
      {renderHeader()}
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