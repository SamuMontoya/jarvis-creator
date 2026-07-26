function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  busy = false,
}) {
  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1100,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '1.75rem',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem', color: '#212529' }}>{title}</h3>
        <p style={{ margin: '0 0 1.5rem', color: '#555' }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '0.65rem 1.25rem',
              border: '1px solid #ced4da',
              borderRadius: '6px',
              backgroundColor: 'white',
              color: '#495057',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: '0.65rem 1.25rem',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: busy ? '#ccc' : '#dc3545',
              color: 'white',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Eliminando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
