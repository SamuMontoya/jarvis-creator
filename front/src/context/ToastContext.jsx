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
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          zIndex: 1000,
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => dismiss(toast.id)}
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              color: 'white',
              backgroundColor: toast.type === 'error' ? '#dc3545' : '#28a745',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              maxWidth: '320px',
            }}
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
