import { memo } from 'react';

function QuestionHeader({ currentIndex, total, title }) {
  return (
    <>
      <div className="mb-2 font-body text-sm text-stone">
        {title} — Pregunta {currentIndex + 1} de {total}
      </div>
      <progress
        value={currentIndex + 1}
        max={total}
        className="mb-4 h-1.5 w-full accent-amber"
      />
    </>
  );
}

export default memo(QuestionHeader);
