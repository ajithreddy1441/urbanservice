import { createContext, useContext, useState } from 'react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = (message, tone = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3400);
  };
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div key={toast.id} className={`pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${toast.tone === 'error' ? 'bg-rose-600' : toast.tone === 'success' ? 'bg-emerald-600' : 'bg-slate-900'}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
