'use client';

import { useEffect, useState, useCallback, createContext, useContext } from 'react';

interface ToastItem {
  id: number;
  message: string;
}

interface ToastContextValue {
  show: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="fixed bottom-8 left-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none"
        style={{ transform: 'translateX(-50%)' }}
      >
        {toasts.map((t) => (
          <ToastItemView key={t.id} message={t.message} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItemView({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      role="alert"
      onClick={onDismiss}
      className="pointer-events-auto cursor-pointer px-5 py-3 rounded-full text-sm font-medium"
      style={{
        background: 'var(--mila-surface, #2a2a2a)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        color: 'var(--mila-text, #f5f5f7)',
        border: '1px solid var(--mila-border, #333)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {message}
    </div>
  );
}
