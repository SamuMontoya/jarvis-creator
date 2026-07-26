import { memo } from 'react';
import ResumenItem from './ResumenItem';

const headingStyle = {
  color: '#444',
  marginTop: '40px',
  marginBottom: '20px',
  paddingBottom: '8px',
  borderBottom: '2px solid #e0e0e0',
  fontSize: '1.5rem',
};

function SeccionRespuestas({ title, respuestas = [], emptyLabel, resolveQuestion, onEdit }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={headingStyle}>{title}</h2>

      {respuestas.length === 0 ? (
        <p style={{ color: '#999' }}>{emptyLabel}</p>
      ) : (
        respuestas.map((resp, idx) => (
          <ResumenItem
            key={resp.id ?? idx}
            index={idx}
            pregunta={resolveQuestion(resp, idx)}
            respuesta={resp.respuesta}
            onClick={() => onEdit(idx)}
          />
        ))
      )}
    </section>
  );
}

export default memo(SeccionRespuestas);
