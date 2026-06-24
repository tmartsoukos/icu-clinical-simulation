/**
 * FocusModal.tsx
 * -----------------------------------------------------------------------------
 * Γενικό "Focus Modal" που ανοίγει πάνω από τη θολωμένη σκηνή ΜΕΘ όταν ο χρήστης
 * αλληλεπιδρά με ένα hotspot. Παρέχει τίτλο, κουμπί κλεισίματος, ESC handling.
 * -----------------------------------------------------------------------------
 */

import { useEffect, type ReactNode } from 'react';

interface FocusModalProps {
  title: string;
  subtitle?: string;
  accent?: 'cyan' | 'green' | 'amber' | 'danger';
  onClose: () => void;
  children: ReactNode;
  /** Μέγιστο πλάτος του modal (Tailwind class), default narrow. */
  widthClass?: string;
}

const ACCENT: Record<NonNullable<FocusModalProps['accent']>, string> = {
  cyan: 'text-clinical-cyan border-clinical-cyan/40',
  green: 'text-clinical-green border-clinical-green/40',
  amber: 'text-clinical-amber border-clinical-amber/40',
  danger: 'text-clinical-danger border-clinical-danger/40',
};

export default function FocusModal({
  title,
  subtitle,
  accent = 'cyan',
  onClose,
  children,
  widthClass = 'max-w-2xl',
}: FocusModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-clinical-bg/70 backdrop-blur-md" onClick={onClose} />

      {/* Panel */}
      <div
        className={`relative z-10 w-full ${widthClass} animate-scale-in overflow-hidden rounded-2xl border border-clinical-border bg-clinical-panel/95 shadow-2xl`}
      >
        <header className={`flex items-center justify-between border-b ${ACCENT[accent]} bg-black/30 px-5 py-3`}>
          <div>
            <h2 className={`text-base font-bold tracking-wide ${ACCENT[accent].split(' ')[0]}`}>{title}</h2>
            {subtitle && <p className="text-xs text-clinical-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-clinical-border px-2.5 py-1 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Κλείσιμο"
          >
            ✕ ESC
          </button>
        </header>
        <div className="max-h-[78vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
