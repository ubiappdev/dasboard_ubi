import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import type { Toast } from '@/types';

const config = {
  success: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  error: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  info: { icon: Info, color: 'text-navy-600', bg: 'bg-navy-50', border: 'border-navy-200' },
};

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-3 w-80">
      {toasts.map((t) => {
        const c = config[t.type];
        const Icon = c.icon;
        return <ToastItem key={t.id} toast={t} config={c} Icon={Icon} onDismiss={onDismiss} />;
      })}
    </div>
  );
}

function ToastItem({
  toast,
  config,
  Icon,
  onDismiss,
}: {
  toast: Toast;
  config: { color: string; bg: string; border: string };
  Icon: typeof CheckCircle2;
  onDismiss: (id: string) => void;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border ${config.border} ${config.bg} px-4 py-3 shadow-card-hover animate-slide-in-right ${
        leaving ? 'animate-toast-out' : ''
      }`}
    >
      <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${config.color}`} />
      <p className="text-sm font-medium text-ink-800 flex-1">{toast.message}</p>
      <button
        onClick={() => {
          setLeaving(true);
          setTimeout(() => onDismiss(toast.id), 300);
        }}
        className="text-ink-400 hover:text-ink-700 transition"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
