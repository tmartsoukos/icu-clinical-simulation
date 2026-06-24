/**
 * Toasts.tsx
 * -----------------------------------------------------------------------------
 * Σύστημα ειδοποιήσεων (toasts) με αυτόματη απόσβεση. Χρησιμοποιείται για
 * feedback ενεργειών, μηνύματα σφάλματος (Error Prevention) και τον συναγερμό
 * υποξαιμίας (danger).
 * -----------------------------------------------------------------------------
 */

import { useEffect } from 'react';
import { useScenario } from '../context/ScenarioContext';
import type { ToastMessage } from '../types';

const STYLE_MAP: Record<ToastMessage['style'], { ring: string; icon: string; text: string }> = {
  info: { ring: 'border-clinical-cyan/50 bg-clinical-cyan/10', icon: 'ℹ️', text: 'text-clinical-cyan' },
  success: { ring: 'border-clinical-green/50 bg-clinical-green/10', icon: '✓', text: 'text-clinical-green' },
  warning: { ring: 'border-clinical-amber/50 bg-clinical-amber/10', icon: '⚠', text: 'text-clinical-amber' },
  danger: { ring: 'border-clinical-danger/60 bg-clinical-danger/10', icon: '⛑', text: 'text-clinical-danger' },
};

function ToastItem({ toast }: { toast: ToastMessage }) {
  const { dismissToast } = useScenario();
  const style = STYLE_MAP[toast.style];
  const ttl = toast.style === 'danger' ? 5000 : 3500;

  useEffect(() => {
    const id = window.setTimeout(() => dismissToast(toast.id), ttl);
    return () => window.clearTimeout(id);
  }, [toast.id, dismissToast, ttl]);

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 backdrop-blur-md shadow-lg animate-slide-in ${style.ring} ${
        toast.style === 'danger' ? 'shadow-glow-danger' : ''
      }`}
    >
      <span className={`mt-0.5 text-lg leading-none ${style.text}`}>{style.icon}</span>
      <p className="flex-1 text-sm font-medium text-slate-100">{toast.message}</p>
      <button
        onClick={() => dismissToast(toast.id)}
        className="text-slate-500 transition-colors hover:text-slate-200"
        aria-label="Κλείσιμο"
      >
        ✕
      </button>
    </div>
  );
}

export default function Toasts() {
  const { state } = useScenario();
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {state.toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
