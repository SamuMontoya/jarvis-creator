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
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(17,16,16,0.5)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="ds-card w-full max-w-[440px] p-7"
      >
        <h3 className="mt-0 mb-3 font-display text-lg font-bold text-ink">{title}</h3>
        <p className="mb-6 font-body text-sm text-stone">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={busy} className="ds-btn ds-btn-outline">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={busy} className="ds-btn ds-btn-danger-outline">
            {busy ? 'Eliminando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
