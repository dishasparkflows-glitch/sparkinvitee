import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { toastListeners } from '../utils/toast';

export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleNewToast = (newToast) => {
      setToasts((prev) => [...prev, newToast]);

      if (newToast.duration > 0) {
        setTimeout(() => {
          removeToast(newToast.id);
        }, newToast.duration);
      }
    };

    toastListeners.add(handleNewToast);
    return () => toastListeners.delete(handleNewToast);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => {
        let Icon = Info;
        let iconColor = 'text-blue-500';
        let bgBadge = 'bg-blue-50';
        let borderAccent = 'border-l-blue-500';

        if (t.type === 'success') {
          Icon = CheckCircle2;
          iconColor = 'text-emerald-500';
          bgBadge = 'bg-emerald-50';
          borderAccent = 'border-l-emerald-500';
        } else if (t.type === 'error') {
          Icon = AlertCircle;
          iconColor = 'text-red-500';
          bgBadge = 'bg-red-50';
          borderAccent = 'border-l-red-500';
        } else if (t.type === 'warning') {
          Icon = AlertTriangle;
          iconColor = 'text-amber-500';
          bgBadge = 'bg-amber-50';
          borderAccent = 'border-l-amber-500';
        }

        return (
          <div
            key={t.id}
            className={`pointer-events-auto bg-white rounded-xl shadow-lg border border-gray-100 border-l-4 ${borderAccent} p-3.5 flex items-start gap-3 transition-all duration-300 animate-in fade-in slide-in-from-top-2`}
            role="alert"
          >
            <div className={`p-1 rounded-full ${bgBadge} ${iconColor} shrink-0 mt-0.5`}>
              <Icon size={16} />
            </div>
            <div className="flex-1 text-sm font-medium text-gray-800 leading-snug break-words">
              {t.message}
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100 transition-colors shrink-0"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
