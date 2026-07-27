import { useEffect, useState } from 'react';
import ErrorMessage from './ErrorMessage';
import { MIN_IDEA_LENGTH, MIN_TITULO_LENGTH } from '../constants';

function EditIdeaDialog({ idea, busy, onSave, onCancel }) {
  const [titulo, setTitulo] = useState('');
  const [texto_idea, setTextoIdea] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (idea) {
      setTitulo(idea.titulo || '');
      setTextoIdea(idea.texto_idea || '');
      setError(null);
    }
  }, [idea]);

  if (!idea) return null;

  const handleSave = () => {
    const trimmedTitulo = titulo.trim();
    const trimmedTexto = texto_idea.trim();
    if (trimmedTitulo.length < MIN_TITULO_LENGTH || trimmedTexto.length < MIN_IDEA_LENGTH) {
      setError('Revisa el título y la descripción antes de guardar.');
      return;
    }
    onSave({ titulo: trimmedTitulo, texto_idea: trimmedTexto });
  };

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(17,16,16,0.5)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editar idea"
        onClick={(e) => e.stopPropagation()}
        className="ds-card w-full max-w-[480px] p-7"
      >
        <h3 className="mt-0 mb-4 font-display text-lg font-bold text-ink">Editar idea</h3>

        <label htmlFor="edit-titulo" className="mb-1 block font-body text-sm font-medium text-ink">
          Título
        </label>
        <input
          id="edit-titulo"
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="ds-input mb-3"
        />

        <label htmlFor="edit-texto" className="mb-1 block font-body text-sm font-medium text-ink">
          Descripción
        </label>
        <textarea
          id="edit-texto"
          rows={4}
          value={texto_idea}
          onChange={(e) => setTextoIdea(e.target.value)}
          className="ds-input"
        />

        <ErrorMessage message={error} />

        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onCancel} disabled={busy} className="ds-btn ds-btn-outline">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={busy} className="ds-btn ds-btn-amber">
            {busy ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditIdeaDialog;
