import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import IdeaForm from './IdeaForm';
import QuestionForm from './QuestionForm';
import ResumenForm from './ResumenForm';
import DynamicQuestionForm from './DynamicQuestionForm';
import MainNav from './MainNav';
import PlanView from './components/PlanView';
import Spinner from './components/Spinner';
import { useApp } from './context/AppContext';
import { useToast } from './context/ToastContext';
import { api } from './api';
import { STAGES, SUCCESS } from './constants';
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
  const { notify } = useToast();
  const [currentSection, setCurrentSection] = useState('ideas');
  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);

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

  // generate-plan is idempotent (returns the existing plan_id instead of
  // regenerating one), so it doubles as the "does this idea have a plan"
  // check that enables the Plan tab.
  useEffect(() => {
    if (!ideaId) {
      setCurrentPlanId(null);
      return;
    }
    let cancelled = false;
    setCurrentPlanId(null);
    api
      .generatePlan(ideaId)
      .then((data) => {
        if (!cancelled) setCurrentPlanId(data.plan_id ?? null);
      })
      .catch(() => {
        // Plan generation failing must not block the rest of the app; the
        // Plan tab simply stays disabled until it succeeds.
      });
    return () => {
      cancelled = true;
    };
  }, [ideaId]);

  // Explicit, user-triggered generation (from the "Generar Plan de Trabajo"
  // button): unlike the silent background check above, this one surfaces
  // errors and jumps straight to the Plan tab on success.
  const handleGeneratePlan = useCallback(
    async (id) => {
      setGeneratingPlan(true);
      try {
        const data = await api.generatePlan(id);
        setCurrentPlanId(data.plan_id ?? null);
        setCurrentSection('plan');
        notify(SUCCESS.PLAN_READY);
      } catch (err) {
        notify(err.message, 'error');
      } finally {
        setGeneratingPlan(false);
      }
    },
    [notify]
  );

  const stages = {
    [STAGES.IDEAS]: <MyIdeas />,
    [STAGES.IDEA]: <IdeaForm />,
    [STAGES.QUESTIONS]: <QuestionForm />,
    [STAGES.QUESTIONS_EDIT]: <QuestionForm editMode />,
    [STAGES.RESUMEN]: <ResumenForm />,
    [STAGES.DYNAMIC_QUESTIONS]: <DynamicQuestionForm />,
    [STAGES.DYNAMIC_QUESTIONS_EDIT]: <DynamicQuestionForm editMode />,
    [STAGES.FINAL_RESUME]: (
      <FinalResumen
        onGeneratePlan={handleGeneratePlan}
        planId={currentPlanId}
        generatingPlan={generatingPlan}
      />
    ),
  };

  return (
    <>
      <MainNav
        currentSection={currentSection}
        onSectionChange={setCurrentSection}
        planId={currentPlanId}
      />
      <Layout ideaText={ideaText}>
        {currentSection === 'ideas' && (stages[stage] ?? <MyIdeas />)}
        {currentSection === 'plan' && <PlanView planId={currentPlanId} ideaId={ideaId} />}
      </Layout>
    </>
  );
}

export default App;
