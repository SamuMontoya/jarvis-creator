import { useState } from 'react';
import ErrorMessage from './components/ErrorMessage';
import { useApp } from './context/AppContext';
import { useToast } from './context/ToastContext';
import { api } from './api';
import { ERRORS, SUCCESS, MIN_IDEA_LENGTH } from './constants';

function IdeaForm() {
  const { startQuestions, setIdeaText, goToIdeas } = useApp();
  const { notify } = useToast();

  const [texto_idea, setTextoIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const trimmed = texto_idea.trim();
  const isTooShort = trimmed.length < MIN_IDEA_LENGTH;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

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
      const data = await api.createIdea(trimmed);
      setIdeaText(trimmed);
      setTextoIdea('');
      notify(SUCCESS.IDEA_CREATED);
      startQuestions(data.idea.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || !trimmed || isTooShort;

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '600px', margin: '2rem auto', padding: '1rem' }}>
      <label htmlFor="idea-input" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
        ¿Qué idea quieres construir?
      </label>
      <textarea
        id="idea-input"
        value={texto_idea}
        onChange={(e) => setTextoIdea(e.target.value)}
        placeholder="¿Qué idea quieres construir?"
        rows={4}
        disabled={loading}
        style={{
          width: '100%',
          padding: '0.75rem',
          fontSize: '1rem',
          border: '1px solid #ccc',
          borderRadius: '4px',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ fontSize: '0.85rem', color: isTooShort && trimmed ? '#dc3545' : '#666', marginTop: '0.25rem' }}>
        {trimmed.length}/{MIN_IDEA_LENGTH} caracteres mínimos
      </div>

      <ErrorMessage message={error} />

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
        <button
          type="button"
          onClick={goToIdeas}
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: 'white',
            color: '#495057',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          Volver
        </button>
        <button
          type="submit"
          disabled={disabled}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: disabled ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </form>
  );
}

export default IdeaForm;
