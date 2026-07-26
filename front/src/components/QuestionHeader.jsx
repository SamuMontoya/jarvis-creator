import { memo } from 'react';

function QuestionHeader({ currentIndex, total, title }) {
  return (
    <>
      <div style={{ marginBottom: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
        {title} — Pregunta {currentIndex + 1} de {total}
      </div>
      <progress
        value={currentIndex + 1}
        max={total}
        style={{ width: '100%', height: '8px', marginBottom: '1rem' }}
      />
    </>
  );
}

export default memo(QuestionHeader);
