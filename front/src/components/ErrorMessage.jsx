function ErrorMessage({ message, onRetry, retryLabel = 'Reintentar' }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="mb-4 border-l-2 px-4 py-3 text-center"
      style={{ borderColor: 'var(--color-danger)', backgroundColor: 'var(--color-paper-warm)' }}
    >
      <p className="m-0 font-body text-sm" style={{ color: 'var(--color-danger)' }}>
        {message}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="ds-btn ds-btn-danger-outline mt-3 !py-2 !px-4 !text-[0.7rem]">
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export default ErrorMessage;
