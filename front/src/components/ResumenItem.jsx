import { memo } from 'react';

function ResumenItem({ index, pregunta, respuesta, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ds-card mb-4 block w-full cursor-pointer p-4 text-left transition-opacity hover:opacity-80"
    >
      <div className="mb-2 font-display text-sm font-bold text-ink">
        {index + 1}. {pregunta}
      </div>
      <div className="whitespace-pre-wrap font-body text-sm text-stone">{respuesta}</div>
    </button>
  );
}

export default memo(ResumenItem);
