import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useApp } from './context/AppContext';
import { api } from './api';

// Wraps every /ideas/:ideaId/* route. Its only job is keeping the header's
// idea banner populated from the URL — including on a hard refresh, when no
// prior navigation has set it yet.
function IdeaRouteLayout() {
  const { ideaId } = useParams();
  const { setIdeaText } = useApp();

  useEffect(() => {
    let cancelled = false;
    api
      .getIdea(ideaId)
      .then((data) => {
        if (!cancelled && data.idea?.titulo) setIdeaText(data.idea.titulo);
      })
      .catch(() => {
        // A failed header fetch must not block the page the user is on; the
        // page component itself surfaces its own load errors.
      });
    return () => {
      cancelled = true;
    };
  }, [ideaId, setIdeaText]);

  return <Outlet />;
}

export default IdeaRouteLayout;
