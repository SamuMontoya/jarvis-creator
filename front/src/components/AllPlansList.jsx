import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListTree } from 'lucide-react';
import Spinner from './Spinner';
import ErrorMessage from './ErrorMessage';
import { api } from '../api';
import { routes } from '../constants';

const formatDateTime = (dateStr) =>
  new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

function AllPlansList() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { plans: data } = await api.listAllPlans();
      setPlans(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner label="Cargando planes..." />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div className="mx-auto max-w-[900px]">
      <h1 className="m-0 font-display text-3xl font-bold text-ink">Planes</h1>
      <p className="mt-2 max-w-[560px] font-body text-stone">
        Todos los planes de trabajo generados, de todas tus ideas, en un solo lugar.
      </p>

      {plans.length === 0 ? (
        <div className="ds-card mt-6 px-4 py-12 text-center text-stone">
          <p className="m-0 font-body">Todavía no has generado ningún plan de trabajo.</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => navigate(routes.plan(plan.idea_id, plan.id))}
              className="ds-card flex w-full items-center justify-between gap-4 p-5 text-left transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-paper-warm text-amber">
                  <ListTree size={18} strokeWidth={1.75} />
                </span>
                <div>
                  <div className="font-display font-semibold text-ink">
                    {plan.idea_titulo || plan.idea_texto}
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

export default AllPlansList;
