import { memo } from 'react';

function QuestionCard({ question, value, onChange, disabled, placeholder = 'Tu respuesta aquí' }) {
  return (
    <>
      <div className="mb-4 border-l-2 border-amber bg-paper-warm px-4 py-3">
        <strong className="font-display font-semibold text-ink">{question}</strong>
      </div>

      <textarea
        aria-label={question}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={4}
        disabled={disabled}
        className="ds-input"
      />
    </>
  );
}

export default memo(QuestionCard);
