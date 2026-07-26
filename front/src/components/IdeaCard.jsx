import { memo } from 'react';
import { IDEA_STATES } from '../constants';

const STATUS_LABELS = {
  [IDEA_STATES.DRAFT]: 'Borrador',
  [IDEA_STATES.REFINED]: 'Completada',
};

function IdeaCard({ idea, onContinue, onDelete, deletingId, formatDate }) {
  const isRefined = idea.estado === IDEA_STATES.REFINED;
  const isDeleting = deletingId === idea.id;

  return (
    <div
      style={{
        padding: '1.5rem',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#fafafa',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          marginBottom: '0.5rem',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#333' }}>{idea.texto_idea}</h3>
        <span
          style={{
            padding: '0.25rem 0.75rem',
            fontSize: '0.8rem',
            backgroundColor: isRefined ? '#28a745' : '#ffc107',
            color: isRefined ? 'white' : '#333',
            borderRadius: '12px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
          }}
        >
          {STATUS_LABELS[idea.estado] || idea.estado}
        </span>
      </div>

      <div style={{ color: '#666', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Creada: {formatDate(idea.created_at)}
        {idea.updated_at !== idea.created_at && (
          <> | Actualizada: {formatDate(idea.updated_at)}</>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => onContinue(idea)}
          disabled={isDeleting}
          style={{
            flex: '1',
            minWidth: '120px',
            padding: '0.75rem',
            fontSize: '1rem',
            backgroundColor: isRefined ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isDeleting ? 'not-allowed' : 'pointer',
          }}
        >
          {isRefined ? 'Ver' : 'Continuar'}
        </button>
        <button
          onClick={() => onDelete(idea.id)}
          disabled={isDeleting}
          style={{
            padding: '0.75rem 1rem',
            fontSize: '1rem',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isDeleting ? 'not-allowed' : 'pointer',
            opacity: isDeleting ? 0.7 : 1,
          }}
        >
          {isDeleting ? 'Eliminando...' : 'Eliminar'}
        </button>
      </div>
    </div>
  );
}

export default memo(IdeaCard);
