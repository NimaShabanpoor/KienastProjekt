// Toast-Container: rendert die aktiven Toasts oben rechts.

import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import type { ToastTone } from '../../store/toastStore';

const toneConfig: Record<ToastTone, { icon: typeof Info; ring: string; text: string; iconColor: string }> = {
  success: { icon: CheckCircle2, ring: 'border-green-200', text: 'text-green-800', iconColor: 'text-green-600' },
  error: { icon: XCircle, ring: 'border-rose-200', text: 'text-rose-800', iconColor: 'text-rose-600' },
  info: { icon: Info, ring: 'border-slate-200', text: 'text-slate-800', iconColor: 'text-brand-red' },
};

export default function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
      {toasts.map((t) => {
        const cfg = toneConfig[t.tone];
        const Icon = cfg.icon;
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border ${cfg.ring} bg-white/95 p-4 shadow-soft backdrop-blur animate-in slide-in-from-top-2`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${cfg.iconColor}`} />
            <p className={`flex-1 text-sm font-medium ${cfg.text}`}>{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Schliessen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
