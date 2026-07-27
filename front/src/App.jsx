import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './Navbar';
import IdeaRouteLayout from './IdeaRouteLayout';
import Spinner from './components/Spinner';

const IdeasDashboard = lazy(() => import('./MyIdeas'));
const IdeaForm = lazy(() => import('./IdeaForm'));
const QuestionForm = lazy(() => import('./QuestionForm'));
const ResumenForm = lazy(() => import('./ResumenForm'));
const DynamicQuestionForm = lazy(() => import('./DynamicQuestionForm'));
const IdeaDetail = lazy(() => import('./IdeaDetail'));
const PlanList = lazy(() => import('./components/PlanList'));
const PlanDetail = lazy(() => import('./components/PlanDetail'));
const AllPlansList = lazy(() => import('./components/AllPlansList'));

function Layout({ children }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8">
        <Suspense fallback={<Spinner />}>{children}</Suspense>
      </main>
    </>
  );
}

function App() {
  return (
    <>
      <div className="ds-grain" />
      <Layout>
        <Routes>
          <Route path="/" element={<IdeasDashboard />} />
          <Route path="/planes" element={<AllPlansList />} />
          <Route path="/ideas/nueva" element={<IdeaForm />} />
          <Route element={<IdeaRouteLayout />}>
            <Route path="/ideas/:ideaId" element={<IdeaDetail />} />
            <Route path="/ideas/:ideaId/preguntas" element={<QuestionForm />} />
            <Route path="/ideas/:ideaId/resumen" element={<ResumenForm />} />
            <Route path="/ideas/:ideaId/analisis" element={<DynamicQuestionForm />} />
            <Route path="/ideas/:ideaId/planes" element={<PlanList />} />
            <Route path="/ideas/:ideaId/planes/:planId" element={<PlanDetail />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </>
  );
}

export default App;
