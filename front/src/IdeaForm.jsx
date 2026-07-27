import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ErrorMessage from './components/ErrorMessage';
import { useApp } from './context/AppContext';
import { useToast } from './context/ToastContext';
import { api } from './api';
import { ERRORS, SUCCESS, MIN_IDEA_LENGTH, MIN_TITULO_LENGTH, routes } from './constants';

function IdeaForm() {
  const { setIdeaText } = useApp();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [titulo, setTitulo] = useState('');
  const [texto_idea, setTextoIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const trimmedTitulo = titulo.trim();
  const trimmed = texto_idea.trim();
  const isTitleTooShort = trimmedTitulo.length < MIN_TITULO_LENGTH;
  const isTooShort = trimmed.length < MIN_IDEA_LENGTH;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!trimmedTitulo) {
      setError(ERRORS.IDEA_TITLE_EMPTY);
      return;
    }

    if (!trimmed) {
      setError(ERRORS.IDEA_EMPTY);
      return;
    }

    if (isTooShort) {
      setError(ERRORS.IDEA_TOO_SHORT);
      return;
    }

    setLoading(true);
    try {
      const data = await api.createIdea(trimmedTitulo, trimmed);
      setIdeaText(trimmedTitulo);
      notify(SUCCESS.IDEA_CREATED);
      navigate(routes.preguntas(data.idea.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || !trimmedTitulo || isTitleTooShort || !trimmed || isTooShort;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-[600px]">
      <span className="ds-eyebrow">Nueva idea</span>
      <h1 className="m-0 mb-6 mt-1 font-display text-2xl font-bold text-ink">
        Cuéntanos qué quieres construir
      </h1>

      <label htmlFor="idea-titulo" className="mb-2 block font-body text-sm font-medium text-ink">
        Título
      </label>
      <input
        id="idea-titulo"
        type="text"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Ej. Paseador de perros"
        disabled={loading}
        className="ds-input mb-1"
      />
      <div className="mb-4 font-body text-xs text-stone">
        {trimmedTitulo.length}/{MIN_TITULO_LENGTH} caracteres mínimos
      </div>

      <label htmlFor="idea-input" className="mb-2 block font-body text-sm font-medium text-ink">
        Descripción
      </label>
      <textarea
        id="idea-input"
        value={texto_idea}
        onChange={(e) => setTextoIdea(e.target.value)}
        placeholder="¿Qué idea quieres construir?"
        rows={4}
        disabled={loading}
        className="ds-input"
      />
      <div
        className="mt-1 font-body text-xs"
        style={{ color: isTooShort && trimmed ? 'var(--color-danger)' : 'var(--color-stone)' }}
      >
        {trimmed.length}/{MIN_IDEA_LENGTH} caracteres mínimos
      </div>

      <ErrorMessage message={error} />

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={() => navigate(routes.home())}
          disabled={loading}
          className="ds-btn ds-btn-outline"
        >
          Volver
        </button>
        <button type="submit" disabled={disabled} className="ds-btn ds-btn-amber flex-1">
          {loading ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </form>
  );
}

export default IdeaForm;
