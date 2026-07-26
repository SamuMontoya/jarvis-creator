function ErrorMessage({ message, onRetry, retryLabel = 'Reintentar' }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      style={{
        padding: '1rem',
        marginBottom: '1rem',
        backgroundColor: '#ffe6e6',
        border: '1px solid #f5c2c7',
        borderRadius: '8px',
        color: '#842029',
        textAlign: 'center',
      }}
    >
      <p style={{ margin: 0 }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: '0.75rem',
            padding: '0.5rem 1.25rem',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: '#dc3545',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export default ErrorMessage;
