// src/components/ui/Toast.jsx
import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const toastStyles = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-800 dark:text-emerald-200',
    icon: CheckCircle,
    iconColor: 'text-emerald-500',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-800 dark:text-red-200',
    icon: XCircle,
    iconColor: 'text-red-500',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-800 dark:text-amber-200',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-200',
    icon: Info,
    iconColor: 'text-blue-500',
  },
};

const Toast = ({ message, type = 'info', onClose }) => {
  const styles = toastStyles[type] || toastStyles.info;
  const Icon = styles.icon;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm animate-slide-in-up ${styles.bg} ${styles.border} ${styles.text}`}
      role="alert"
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${styles.iconColor}`} />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        aria-label="Close"
      >
        <X className="w-4 h-4 opacity-70 hover:opacity-100" />
      </button>
    </div>
  );
};

export default Toast;