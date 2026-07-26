import { memo } from 'react';

function QuestionCard({ question, value, onChange, disabled, placeholder = 'Tu respuesta aquí' }) {
  return (
    <>
      <div
        style={{
          backgroundColor: '#f5f5f5',
          padding: '1rem',
          borderRadius: '4px',
          marginBottom: '1rem',
        }}
      >
        <strong>{question}</strong>
      </div>

      <textarea
        aria-label={question}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={4}
        disabled={disabled}
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
    </>
  );
}

export default memo(QuestionCard);
