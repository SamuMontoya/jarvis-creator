import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ListTree, RefreshCw } from 'lucide-react';
import Spinner from './Spinner';
import ErrorMessage from './ErrorMessage';
import { useToast } from '../context/ToastContext';
import { api } from '../api';
import { SUCCESS, routes } from '../constants';

const formatDateTime = (dateStr) =>
  new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

function PlanList() {
  const { ideaId } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { plans: data } = await api.getPlansForIdea(ideaId);
      setPlans(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerateVersion = async () => {
    setGenerating(true);
    try {
      const data = await api.generatePlan(ideaId, { force: true });
      notify(SUCCESS.PLAN_READY);
      navigate(routes.plan(ideaId, data.plan_id));
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <Spinner label="Cargando planes..." />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div className="mx-auto max-w-[800px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => navigate(routes.idea(ideaId))} className="ds-btn ds-btn-outline">
          <ArrowLeft size={16} strokeWidth={1.75} />
          Volver a la idea
        </button>
        <button onClick={handleGenerateVersion} disabled={generating} className="ds-btn ds-btn-amber">
          <RefreshCw size={16} strokeWidth={1.75} />
          {generating ? 'Generando...' : 'Generar nueva versión'}
        </button>
      </div>

      <span className="ds-eyebrow">Plan de trabajo</span>
      <h1 className="m-0 mt-1 mb-6 font-display text-2xl font-bold text-ink">Versiones del plan</h1>

      {plans.length === 0 ? (
        <div className="ds-card px-4 py-12 text-center text-stone">
          <p className="m-0 font-body">Todavía no has generado un plan de trabajo para esta idea.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {plans.map((plan, index) => (
            <button
              key={plan.id}
              onClick={() => navigate(routes.plan(ideaId, plan.id))}
              className="ds-card flex w-full items-center justify-between gap-4 p-5 text-left transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-warm text-amber">
                  <ListTree size={18} strokeWidth={1.75} />
                </span>
                <div>
                  <div className="font-display font-semibold text-ink">
                    {index === 0 ? 'Versión más reciente' : `Versión del ${formatDateTime(plan.created_at)}`}
                  </div>
                  <div className="font-body text-xs text-stone">
                    Generado el {formatDateTime(plan.created_at)} · {plan.epicas_count} épicas
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default PlanList;
