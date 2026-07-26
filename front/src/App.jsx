import { lazy, Suspense, useEffect } from 'react';
import IdeaForm from './IdeaForm';
import QuestionForm from './QuestionForm';
import ResumenForm from './ResumenForm';
import DynamicQuestionForm from './DynamicQuestionForm';
import Spinner from './components/Spinner';
import { useApp } from './context/AppContext';
import { api } from './api';
import { STAGES } from './constants';
import './App.css';

const MyIdeas = lazy(() => import('./MyIdeas'));
const FinalResumen = lazy(() => import('./FinalResumen'));

function Header({ ideaText }) {
  return (
    <section id="center">
      <div className="hero">
        <h1>JARVIS Creator</h1>
        {ideaText && <div className="hero-idea">{ideaText}</div>}
      </div>
    </section>
  );
}

function Layout({ ideaText, children }) {
  return (
    <>
      <Header ideaText={ideaText} />
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>
        <Suspense fallback={<Spinner />}>{children}</Suspense>
      </main>
    </>
  );
}

function App() {
  const { stage, ideaId, ideaText, setIdeaText } = useApp();

  // The header shows the idea text on every stage, including after a reload
  // that restored the session from storage.
  useEffect(() => {
    if (!ideaId || ideaText) return;
    let cancelled = false;
    api
      .getIdea(ideaId)
      .then((data) => {
        if (!cancelled && data.idea?.texto_idea) setIdeaText(data.idea.texto_idea);
      })
      .catch(() => {
        // A failed header fetch must not block the stage the user is on; the
        // stage component surfaces its own load errors.
      });
    return () => {
      cancelled = true;
    };
  }, [ideaId, ideaText, setIdeaText]);

  const stages = {
    [STAGES.IDEAS]: <MyIdeas />,
    [STAGES.IDEA]: <IdeaForm />,
    [STAGES.QUESTIONS]: <QuestionForm />,
    [STAGES.QUESTIONS_EDIT]: <QuestionForm editMode />,
    [STAGES.RESUMEN]: <ResumenForm />,
    [STAGES.DYNAMIC_QUESTIONS]: <DynamicQuestionForm />,
    [STAGES.DYNAMIC_QUESTIONS_EDIT]: <DynamicQuestionForm editMode />,
    [STAGES.FINAL_RESUME]: <FinalResumen />,
  };

  return <Layout ideaText={ideaText}>{stages[stage] ?? <MyIdeas />}</Layout>;
}

export default App;
