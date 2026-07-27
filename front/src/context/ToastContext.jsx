import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';

const ToastContext = createContext(null);

const TOAST_DURATION_MS = 3000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message, type = 'success') => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, type }]);
      timers.current.push(setTimeout(() => dismiss(id), TOAST_DURATION_MS));
    },
    [dismiss]
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => dismiss(toast.id)}
            className="max-w-[320px] cursor-pointer border-l-2 px-5 py-3 font-body text-sm"
            style={
              toast.type === 'error'
                ? { backgroundColor: 'var(--color-ink)', color: 'var(--color-white)', borderColor: 'var(--color-danger)' }
                : { backgroundColor: 'var(--color-white)', color: 'var(--color-ink)', borderColor: 'var(--color-amber)', border: '1px solid var(--color-dust)', borderLeftWidth: '2px', borderLeftColor: 'var(--color-amber)' }
            }
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>');
  }
  return context;
}
