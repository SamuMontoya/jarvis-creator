import { useState } from 'react';
import IdeaForm from './IdeaForm';
import QuestionForm from './QuestionForm';
import './App.css';

function App() {
  const [stage, setStage] = useState('idea');
  const [ideaId, setIdeaId] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const handleIdeaCreated = (id) => {
    setIdeaId(id);
    setStage('questions');
    setCurrentQuestionIndex(0);
  };

  const handleNext = () => {
    setCurrentQuestionIndex(prev => prev + 1);
  };

  const handleComplete = () => {
    alert('¡Todas las preguntas respondidas! Idea ID: ' + ideaId);
    setStage('idea');
    setIdeaId(null);
    setCurrentQuestionIndex(0);
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

  return (
    <>
      <section id="center">
        <div className="hero">
          <h1>JARVIS Creator - Preguntas</h1>
        </div>
      </section>
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
        <QuestionForm
          idea_id={ideaId}
          currentQuestionIndex={currentQuestionIndex}
          onNext={handleNext}
          onComplete={handleComplete}
        />
      </main>
    </>
  );
}

export default App;