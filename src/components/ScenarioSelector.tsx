/**
 * ScenarioSelector.tsx
 * -----------------------------------------------------------------------------
 * Αρχική οθόνη (Landing Page). Εμφανίζει τη λίστα διαθέσιμων σεναρίων με τα
 * μετα-δεδομένα τους (Τίτλος, Δυσκολία, Διάρκεια, Μαθησιακοί Στόχοι) και
 * επιτρέπει: εκκίνηση, φόρτωση custom JSON σεναρίου, reset κατάστασης.
 * -----------------------------------------------------------------------------
 */

import { useRef, useState } from 'react';
import { useScenario } from '../context/ScenarioContext';
import type { Scenario } from '../types';

export default function ScenarioSelector({ builtIn }: { builtIn: Scenario }) {
  const { state, loadScenario, start, pushToast } = useScenario();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState(state.scenario?.scenario_meta.id ?? builtIn.scenario_meta.id);

  // Λίστα σεναρίων: το ενσωματωμένο + (προαιρετικά) το φορτωμένο custom.
  const scenarios: Scenario[] = [builtIn];
  if (state.scenario && state.scenario.scenario_meta.id !== builtIn.scenario_meta.id) {
    scenarios.push(state.scenario);
  }
  const active = scenarios.find((s) => s.scenario_meta.id === selectedId) ?? builtIn;
  const meta = active.scenario_meta;

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Scenario;
        if (!parsed.scenario_meta || !parsed.nodes) {
          throw new Error('Λείπουν υποχρεωτικά πεδία (scenario_meta / nodes).');
        }
        loadScenario(parsed);
        setSelectedId(parsed.scenario_meta.id);
        pushToast(`Φορτώθηκε σενάριο: ${parsed.scenario_meta.title}`, 'success');
      } catch (err) {
        pushToast(`Σφάλμα φόρτωσης JSON: ${(err as Error).message}`, 'danger');
      }
    };
    reader.readAsText(file);
  };

  const handleStart = () => {
    // Βεβαιωνόμαστε ότι το επιλεγμένο σενάριο είναι το ενεργό στη μηχανή.
    if (state.scenario?.scenario_meta.id !== active.scenario_meta.id) {
      loadScenario(active);
      // Το start θα τρέξει στο επόμενο tick όταν το scenario είναι ενημερωμένο.
      setTimeout(() => start(), 0);
    } else {
      start();
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full animate-fade-in">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-clinical-cyan/30 bg-clinical-cyan/5 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-clinical-green" />
            <span className="text-xs font-semibold uppercase tracking-widest text-clinical-cyan">
              ICU Clinical Simulation
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 md:text-4xl">
            Προσομοιωτής <span className="text-clinical-cyan text-glow-cyan">ΜΕΘ</span>
          </h1>
          <p className="mt-2 text-sm text-clinical-muted">
            Διαδραστικό σενάριο κλινικής λήψης αποφάσεων · Εργασία Αλληλεπίδρασης Ανθρώπου–Υπολογιστή
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-[280px_1fr]">
          {/* Scenario list */}
          <aside className="space-y-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-wider text-clinical-muted">Σενάρια</p>
            {scenarios.map((s) => {
              const isActive = s.scenario_meta.id === selectedId;
              return (
                <button
                  key={s.scenario_meta.id}
                  onClick={() => setSelectedId(s.scenario_meta.id)}
                  className={`flex w-full flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                    isActive
                      ? 'border-clinical-cyan bg-clinical-cyan/10 shadow-glow'
                      : 'border-clinical-border bg-clinical-panel/60 hover:border-clinical-cyan/40'
                  }`}
                >
                  <span className="text-sm font-semibold text-slate-100">{s.scenario_meta.title}</span>
                  <span className="text-[11px] text-clinical-muted">
                    {s.scenario_meta.difficulty} · {s.scenario_meta.estimated_duration_minutes}′
                  </span>
                </button>
              );
            })}

            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-clinical-border bg-transparent p-3 text-xs font-medium text-clinical-muted transition-colors hover:border-clinical-cyan/50 hover:text-clinical-cyan"
            >
              ⬆ Φόρτωση JSON σεναρίου
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
          </aside>

          {/* Scenario detail */}
          <section className="rounded-2xl border border-clinical-border bg-clinical-panel/70 p-6 backdrop-blur">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-clinical-amber/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-clinical-amber">
                {meta.difficulty}
              </span>
              <span className="rounded-md bg-clinical-cyan/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-clinical-cyan">
                ⏱ {meta.estimated_duration_minutes} λεπτά
              </span>
              <span className="rounded-md bg-white/5 px-2.5 py-1 font-mono text-[11px] text-clinical-muted">
                {active.nodes.length} κόμβοι
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-100">{meta.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{meta.description}</p>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-clinical-green">
                🎯 Μαθησιακοί Στόχοι
              </p>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {meta.learning_goals.map((g, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-clinical-border bg-black/20 px-3 py-2 text-sm text-slate-300"
                  >
                    <span className="mt-0.5 text-clinical-green">✓</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 rounded-lg border border-clinical-border bg-black/20 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-clinical-muted">
                Ενεργά Στοιχεία Σκηνής (Hotspots)
              </p>
              <div className="flex flex-wrap gap-2">
                {active.hotspots.map((h) => (
                  <span
                    key={h.id}
                    className="rounded-full border border-clinical-border bg-clinical-panel2 px-3 py-1 text-xs text-slate-300"
                  >
                    {h.label}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={handleStart}
              className="mt-6 w-full rounded-xl border border-clinical-cyan/60 bg-clinical-cyan/15 px-6 py-3.5 text-base font-bold uppercase tracking-wider text-clinical-cyan transition-all hover:bg-clinical-cyan/25 hover:shadow-glow"
            >
              ▶ Έναρξη Προσομοίωσης
            </button>
            <p className="mt-2 text-center text-[11px] text-clinical-muted">
              Η εκκίνηση κάνει reset όλων των δεδομένων κατάστασης & καταγραφής.
            </p>
          </section>
        </div>

        <footer className="mt-8 text-center text-[11px] text-clinical-muted">
          React · Vite · TypeScript · Tailwind CSS — HCI / UX ιατρικών εφαρμογών
        </footer>
      </div>
    </div>
  );
}
