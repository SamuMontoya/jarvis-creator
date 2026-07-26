import { memo } from 'react';

function ResumenItem({ index, pregunta, respuesta, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        marginBottom: '1.5rem',
        padding: '1rem',
        border: '1px solid #ddd',
        borderRadius: '4px',
        backgroundColor: '#fafafa',
        cursor: 'pointer',
        font: 'inherit',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#333' }}>
        {index + 1}. {pregunta}
      </div>
      <div style={{ whiteSpace: 'pre-wrap', color: '#555' }}>{respuesta}</div>
    </button>
  );
}

export default memo(ResumenItem);
