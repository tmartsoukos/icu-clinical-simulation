/**
 * DebriefScreen.tsx
 * -----------------------------------------------------------------------------
 * Τελική οθόνη (node type: "end"). Παρουσιάζει:
 *  - Τελικό Score & σύνοψη επίδοσης
 *  - Visual Timeline (step indicator) με πράσινα/κόκκινα ορόσημα + hover details
 *  - Decision Path (διαδρομή αποφάσεων)
 *  - Έλεγχο ελλιπούς τεκμηρίωσης (highlight_missed_docs)
 *  - Export Logs σε JSON ή CSV
 * -----------------------------------------------------------------------------
 */

import { useMemo, useState } from 'react';
import { useScenario } from '../context/ScenarioContext';
import type { LogEvent } from '../types';

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCSV(log: LogEvent[]): string {
  const header = ['seq', 'type', 'timestamp', 'elapsedMs', 'nodeId', 'label', 'scoreDelta', 'outcome'];
  const rows = log.map((e) =>
    [
      e.seq,
      e.type,
      e.timestamp,
      e.elapsedMs,
      e.nodeId ?? '',
      `"${e.label.replace(/"/g, '""')}"`,
      e.scoreDelta ?? '',
      e.outcome ?? '',
    ].join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

const OUTCOME_COLOR: Record<NonNullable<LogEvent['outcome']>, string> = {
  positive: 'bg-clinical-green border-clinical-green text-clinical-green',
  negative: 'bg-clinical-danger border-clinical-danger text-clinical-danger',
  neutral: 'bg-clinical-cyan border-clinical-cyan text-clinical-cyan',
};

export default function DebriefScreen() {
  const { state, reset } = useScenario();
  const scenario = state.scenario!;
  const debrief = scenario.nodes.find((n) => n.type === 'end')?.debrief_config;
  const [hovered, setHovered] = useState<LogEvent | null>(null);

  const decisions = useMemo(
    () => state.log.filter((e) => e.type === 'OPTION_SELECTED'),
    [state.log],
  );

  // Ορόσημα timeline: αποφάσεις, gates, timeouts, vitals changes.
  const milestones = useMemo(
    () =>
      state.log.filter((e) =>
        ['OPTION_SELECTED', 'GATE_PASSED', 'GATE_BLOCKED', 'TIMEOUT', 'EHR_SUBMIT'].includes(e.type),
      ),
    [state.log],
  );

  // Έλεγχος ελλιπούς τεκμηρίωσης βάσει flags.
  const docFlags = [
    { key: 'documentation_1_complete', label: 'Τεκμηρίωση Αξιολόγησης & Παρέμβασης' },
    { key: 'documentation_2_complete', label: 'Καταγραφή Επικοινωνίας' },
    { key: 'escalation_complete', label: 'Κλιμάκωση (Κλήση Ιατρού)' },
    { key: 'oxygen_adjusted', label: 'Ρύθμιση Οξυγόνου (FiO₂)' },
    { key: 'assessment_complete', label: 'Άμεση Κλινική Αξιολόγηση' },
  ];

  const maxScore = scenario.initial_state.current_score + 55; // άθροισμα θετικών deltas
  const scorePct = Math.max(0, Math.min(100, Math.round((state.score / maxScore) * 100)));
  const grade =
    state.score >= 130 ? 'Άριστα' : state.score >= 110 ? 'Πολύ Καλά' : state.score >= 90 ? 'Καλά' : 'Χρειάζεται Βελτίωση';
  const gradeColor =
    state.score >= 110 ? 'text-clinical-green' : state.score >= 90 ? 'text-clinical-cyan' : 'text-clinical-danger';

  const exportJSON = () =>
    downloadFile(
      `icu_log_${scenario.scenario_meta.id}.json`,
      JSON.stringify(
        {
          scenario: scenario.scenario_meta,
          final_score: state.score,
          final_vitals: state.vitals,
          flags: state.flags,
          log: state.log,
        },
        null,
        2,
      ),
      'application/json',
    );

  const exportCSV = () =>
    downloadFile(`icu_log_${scenario.scenario_meta.id}.csv`, toCSV(state.log), 'text/csv');

  return (
    <div className="mx-auto max-w-6xl animate-fade-in p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-2 rounded-full border border-clinical-green/40 bg-clinical-green/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-clinical-green">
          ✓ Σενάριο Ολοκληρώθηκε
        </span>
        <h1 className="text-2xl font-extrabold text-slate-100">{scenario.scenario_meta.title}</h1>
        <p className="mt-1 text-sm text-clinical-muted">Debrief & Ανάλυση Επίδοσης</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Score card */}
        {debrief?.show_score !== false && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-clinical-border bg-clinical-panel/70 p-6">
            <div className="relative flex h-40 w-40 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#1c2942" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke={state.score >= 110 ? '#34f5a0' : state.score >= 90 ? '#22d3ee' : '#ff3b4e'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(scorePct / 100) * 327} 327`}
                  style={{ transition: 'stroke-dasharray 1s ease-out' }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className={`font-mono text-4xl font-extrabold ${gradeColor}`}>{state.score}</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-500">points</span>
              </div>
            </div>
            <p className={`mt-3 text-lg font-bold ${gradeColor}`}>{grade}</p>
            <p className="text-xs text-clinical-muted">
              {decisions.length} αποφάσεις · {state.log.length} events
            </p>
          </div>
        )}

        {/* Missed docs / flags */}
        {debrief?.highlight_missed_docs !== false && (
          <div className="rounded-2xl border border-clinical-border bg-clinical-panel/70 p-5 lg:col-span-2">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-clinical-cyan">
              Έλεγχος Τεκμηρίωσης & Πρωτοκόλλου
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {docFlags.map((d) => {
                const done = !!state.flags[d.key];
                return (
                  <div
                    key={d.key}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      done
                        ? 'border-clinical-green/30 bg-clinical-green/5 text-slate-200'
                        : 'border-clinical-danger/40 bg-clinical-danger/5 text-slate-300'
                    }`}
                  >
                    <span className={done ? 'text-clinical-green' : 'text-clinical-danger'}>
                      {done ? '✓' : '✕'}
                    </span>
                    <span className="flex-1">{d.label}</span>
                    {!done && (
                      <span className="text-[10px] font-semibold uppercase text-clinical-danger">Παραλείφθηκε</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="HR" value={`${state.vitals.hr}`} />
              <MiniStat label="SpO₂" value={`${state.vitals.spo2}%`} danger={state.vitals.spo2 < 90} />
              <MiniStat label="RR" value={`${state.vitals.rr}`} />
              <MiniStat label="BP" value={state.vitals.bp} />
            </div>
          </div>
        )}
      </div>

      {/* Visual timeline */}
      <div className="mt-6 rounded-2xl border border-clinical-border bg-clinical-panel/70 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-clinical-cyan">
            Visual Timeline — Χρονική Σειρά Αποφάσεων
          </h2>
          <div className="flex items-center gap-3 text-[11px] text-clinical-muted">
            <Legend color="bg-clinical-green" label="Σωστή" />
            <Legend color="bg-clinical-danger" label="Λάθος / Timeout" />
            <Legend color="bg-clinical-cyan" label="Ουδέτερη" />
          </div>
        </div>

        {/* Step indicator track */}
        <div className="relative overflow-x-auto pb-10 pt-2">
          <div className="flex min-w-max items-center gap-0">
            {milestones.map((e, idx) => {
              const color = OUTCOME_COLOR[e.outcome ?? 'neutral'];
              return (
                <div key={e.seq} className="flex items-center">
                  <div
                    className="group relative flex flex-col items-center"
                    onMouseEnter={() => setHovered(e)}
                    onMouseLeave={() => setHovered((h) => (h?.seq === e.seq ? null : h))}
                  >
                    <button
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 bg-opacity-20 font-mono text-xs font-bold transition-transform hover:scale-125 ${color}`}
                    >
                      {idx + 1}
                    </button>
                    <span className="mt-1.5 w-24 truncate text-center text-[10px] text-clinical-muted">
                      {(e.elapsedMs / 1000).toFixed(1)}s
                    </span>

                    {/* Hover tooltip */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-lg border border-clinical-border bg-clinical-bg/95 p-3 text-left shadow-xl group-hover:block">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-clinical-cyan">{e.type}</p>
                      <p className="mt-1 text-xs text-slate-100">{e.label}</p>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-clinical-muted">
                        <span>κόμβος: {e.nodeId ?? '—'}</span>
                        {typeof e.scoreDelta === 'number' && e.scoreDelta !== 0 && (
                          <span className={e.scoreDelta > 0 ? 'text-clinical-green' : 'text-clinical-danger'}>
                            {e.scoreDelta > 0 ? '+' : ''}
                            {e.scoreDelta} pts
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {idx < milestones.length - 1 && (
                    <div className="mx-1 h-0.5 w-10 shrink-0 self-start bg-clinical-border" style={{ marginTop: 18 }} />
                  )}
                </div>
              );
            })}
            {milestones.length === 0 && (
              <p className="text-sm text-clinical-muted">Δεν καταγράφηκαν ορόσημα.</p>
            )}
          </div>
        </div>

        {hovered && (
          <div className="rounded-lg border border-clinical-border bg-black/40 p-3 text-xs text-slate-300">
            <span className="font-semibold text-clinical-cyan">#{hovered.seq}</span> · {hovered.timestamp.split('T')[1]?.replace('Z', '')} — {hovered.label}
          </div>
        )}
      </div>

      {/* Decision path */}
      {debrief?.show_decision_path !== false && (
        <div className="mt-6 rounded-2xl border border-clinical-border bg-clinical-panel/70 p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-clinical-cyan">Decision Path</h2>
          <ol className="space-y-2">
            {decisions.map((e, i) => (
              <li key={e.seq} className="flex items-center gap-3 text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-clinical-cyan/15 font-mono text-[11px] text-clinical-cyan">
                  {i + 1}
                </span>
                <span className="flex-1 text-slate-200">{e.label}</span>
                {typeof e.scoreDelta === 'number' && (
                  <span
                    className={`font-mono text-xs ${
                      e.scoreDelta > 0
                        ? 'text-clinical-green'
                        : e.scoreDelta < 0
                          ? 'text-clinical-danger'
                          : 'text-clinical-muted'
                    }`}
                  >
                    {e.scoreDelta > 0 ? '+' : ''}
                    {e.scoreDelta}
                  </span>
                )}
              </li>
            ))}
            {decisions.length === 0 && <li className="text-sm text-clinical-muted">Καμία απόφαση.</li>}
          </ol>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {debrief?.export_log !== false && (
          <>
            <button
              onClick={exportJSON}
              className="rounded-lg border border-clinical-cyan/50 bg-clinical-cyan/10 px-5 py-2.5 text-sm font-semibold text-clinical-cyan transition-all hover:bg-clinical-cyan/20 hover:shadow-glow"
            >
              ⬇ Export Logs (JSON)
            </button>
            <button
              onClick={exportCSV}
              className="rounded-lg border border-clinical-green/50 bg-clinical-green/10 px-5 py-2.5 text-sm font-semibold text-clinical-green transition-all hover:bg-clinical-green/20 hover:shadow-glow-green"
            >
              ⬇ Export Logs (CSV)
            </button>
          </>
        )}
        <button
          onClick={reset}
          className="rounded-lg border border-clinical-border bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-all hover:bg-white/10"
        >
          ⟲ Νέα Προσομοίωση
        </button>
      </div>
    </div>
  );
}

function MiniStat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-lg border border-clinical-border bg-black/30 p-2 text-center">
      <p className="text-[9px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`font-mono text-sm font-bold ${danger ? 'text-clinical-danger' : 'text-slate-200'}`}>{value}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
