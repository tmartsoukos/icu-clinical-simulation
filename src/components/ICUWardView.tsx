/**
 * ICUWardView.tsx
 * -----------------------------------------------------------------------------
 * Κύρια οθόνη προσομοίωσης (Focus-Based / Direct Manipulation). Περιλαμβάνει:
 *  - Ρεαλιστικό φόντο ΜΕΘ (background image: /icu-bg.png) με XR vibe
 *  - 5 hotspots ως ημιδιαφανή κυανά "Pulse Rings" με ιατρικά εικονίδια,
 *    απόλυτα τοποθετημένα πάνω στην εικόνα (Recognition rather than Recall)
 *  - blur της σκηνής + Focus Modal κατά την αλληλεπίδραση
 *  - HUD (score / χρόνος / κατάσταση κόμβου) & live mini-vitals overlay
 *  - Timeout Progress Bar (30s) στον κόμβο n2
 *  - ακουστικός/οπτικός συναγερμός υποξαιμίας (κόκκινο pulse ring στο μόνιτορ)
 * -----------------------------------------------------------------------------
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useScenario } from '../context/ScenarioContext';
import { useAlarmSound } from '../hooks/useAlarmSound';
import type { DecisionOption } from '../types';
import EHRModal from './EHRModal';
import FocusModal from './FocusModal';
import VitalsMonitor from './VitalsMonitor';
import WaveformCanvas from './WaveformCanvas';

/* --------------------------- Medical icons (SVG) ------------------------- */

const ICONS: Record<string, ReactNode> = {
  hs_monitor: (
    // καρδιά + παλμός
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h3l2-5 3 9 2-6 1.5 2H21" />
    </svg>
  ),
  hs_patient: (
    // κρεβάτι
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8v10M3 13h18v5M21 18v-4a3 3 0 0 0-3-3h-7v3" />
      <circle cx="7" cy="10" r="1.6" />
    </svg>
  ),
  hs_ventilator: (
    // πνεύμονες
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v8" />
      <path d="M9 7c0 4-2 5-3.5 6.5C4 15 5 20 7.5 20S10 18 10 15v-4a2 2 0 0 0-1-2Z" />
      <path d="M15 7c0 4 2 5 3.5 6.5C20 15 19 20 16.5 20S14 18 14 15v-4a2 2 0 0 1 1-2Z" />
    </svg>
  ),
  hs_ehr: (
    // clipboard
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4h6v3H9zM9 12h6M9 16h4" />
    </svg>
  ),
  hs_call: (
    // καμπάνα
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  ),
};

/* --------------------------- Hotspot positions --------------------------- */
/* Συντεταγμένες (%) πάνω στην εικόνα /icu-bg.png. Εύκολα ρυθμιζόμενες ώστε να
 * ταιριάζουν ακριβώς με τα στοιχεία της φωτογραφίας του θαλάμου. */
const HOTSPOT_POS: Record<string, { top: string; left: string }> = {
  hs_monitor: { top: '33%', left: '30%' },
  hs_ventilator: { top: '61%', left: '18%' },
  hs_patient: { top: '55%', left: '40%' },
  hs_ehr: { top: '38%', left: '82%' },
  hs_call: { top: '68%', left: '54%' },
};

/* ------------------------------ Timeout bar ------------------------------ */

function TimeoutBar({ seconds, nodeId, onExpire }: { seconds: number; nodeId: string; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    setRemaining(seconds);
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, seconds - elapsed);
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        window.clearInterval(interval);
        onExpire();
      }
    }, 100);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, seconds]);

  const pct = (remaining / seconds) * 100;
  const danger = remaining <= 10;

  return (
    <div className="animate-fade-in rounded-xl border border-clinical-border bg-clinical-panel/80 p-3 backdrop-blur">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-clinical-amber">
          ⏱ Χρόνος Απόκρισης
        </span>
        <span className={`font-mono text-sm font-bold ${danger ? 'text-clinical-danger animate-blink' : 'text-clinical-amber'}`}>
          {remaining.toFixed(1)}s
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/60">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
            danger ? 'bg-clinical-danger' : 'bg-gradient-to-r from-clinical-amber to-clinical-green'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-clinical-muted">
        Καθυστέρηση απόφασης ⇒ ποινή score & επιδείνωση ζωτικών.
      </p>
    </div>
  );
}

/* ------------------------------- Pulse Ring ------------------------------ */

type Tone = 'cyan' | 'danger' | 'idle';

function PulseRing({
  hotspotId,
  label,
  tone,
  onClick,
}: {
  hotspotId: string;
  label: string;
  tone: Tone;
  onClick: () => void;
}) {
  const pos = HOTSPOT_POS[hotspotId];
  if (!pos) return null;

  const palette: Record<Tone, { ring: string; ping: string; text: string; core: string; pingAnim: string }> = {
    cyan: {
      ring: 'border-clinical-cyan/80',
      ping: 'bg-clinical-cyan/40',
      text: 'text-clinical-cyan',
      core: 'bg-clinical-cyan/15',
      pingAnim: 'animate-ping',
    },
    danger: {
      ring: 'border-clinical-danger',
      ping: 'bg-clinical-danger/50',
      text: 'text-clinical-danger',
      core: 'bg-clinical-danger/20',
      pingAnim: 'animate-ping [animation-duration:0.9s]',
    },
    idle: {
      ring: 'border-slate-400/40',
      ping: 'bg-slate-400/10',
      text: 'text-slate-300',
      core: 'bg-white/5',
      pingAnim: '',
    },
  };
  const c = palette[tone];
  const active = tone !== 'idle';

  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{ top: pos.top, left: pos.left }}
      className="group absolute z-20 -translate-x-1/2 -translate-y-1/2 outline-none"
    >
      <span className="relative flex h-16 w-16 items-center justify-center">
        {/* Soft ping halo (μόνο όταν ενεργό) */}
        {c.pingAnim && (
          <span className={`absolute inline-flex h-full w-full rounded-full ${c.ping} ${c.pingAnim}`} />
        )}
        {/* Static glow ring */}
        <span
          className={`absolute inline-flex h-full w-full rounded-full border-2 ${c.ring} ${
            tone === 'danger'
              ? 'shadow-glow-danger'
              : tone === 'cyan'
                ? 'shadow-glow animate-pulse-glow'
                : ''
          } backdrop-blur-[2px] transition-all group-hover:scale-110`}
        />
        {/* Core disc + icon */}
        <span
          className={`relative flex h-9 w-9 items-center justify-center rounded-full ${c.core} ${c.text} transition-transform group-hover:scale-110`}
        >
          <span className="h-5 w-5">{ICONS[hotspotId]}</span>
        </span>
      </span>

      {/* Hover label chip */}
      <span
        className={`pointer-events-none absolute left-1/2 top-[110%] -translate-x-1/2 whitespace-nowrap rounded-md border border-clinical-border bg-clinical-bg/90 px-2 py-0.5 text-[11px] font-medium ${c.text} opacity-0 shadow-lg backdrop-blur transition-opacity duration-200 group-hover:opacity-100`}
      >
        {label}
      </span>

      {/* Guidance dot */}
      {active && tone !== 'danger' && (
        <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-clinical-cyan shadow-glow" />
      )}
    </button>
  );
}

/* --------------------------- Hotspot modal body -------------------------- */

function OptionButtons({ options }: { options: DecisionOption[] }) {
  const { selectOption } = useScenario();
  if (options.length === 0) return null;
  return (
    <div className="mt-5 space-y-2 border-t border-clinical-border pt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-clinical-muted">Διαθέσιμες Ενέργειες</p>
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => selectOption(opt)}
          className="flex w-full items-center justify-between rounded-lg border border-clinical-cyan/40 bg-clinical-cyan/10 px-4 py-3 text-left text-sm font-medium text-slate-100 transition-all hover:border-clinical-cyan hover:bg-clinical-cyan/20 hover:shadow-glow"
        >
          <span>{opt.label}</span>
          <span className="text-clinical-cyan">➔</span>
        </button>
      ))}
    </div>
  );
}

function HotspotModalContent({ hotspotId }: { hotspotId: string }) {
  const { state, currentNode } = useScenario();
  const optionsHere =
    currentNode?.type === 'decision'
      ? (currentNode.options ?? []).filter((o) => o.target_hotspot === hotspotId)
      : [];

  switch (hotspotId) {
    case 'hs_monitor':
      return (
        <div className="space-y-4">
          <VitalsMonitor vitals={state.vitals} alarm={state.monitorAlert} />
          <div className="rounded-lg border border-clinical-border bg-black/30 p-3 text-sm text-slate-300">
            <p className="mb-1 font-semibold text-clinical-cyan">Ιστορικό Τάσης (5')</p>
            <p className="text-xs text-slate-400">
              Παρατηρείται προοδευτική πτώση του SpO₂ τα τελευταία 5 λεπτά με αντισταθμιστική ταχυκαρδία. Η αναπνευστική
              συχνότητα παραμένει αυξημένη.
            </p>
          </div>
          <OptionButtons options={optionsHere} />
        </div>
      );

    case 'hs_patient':
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-clinical-border bg-gradient-to-br from-clinical-panel2 to-black/40 p-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="text-4xl">🛏️</span>
              <div>
                <p className="font-semibold text-slate-100">Ασθενής — Κλίνη 1</p>
                <p className="text-xs text-clinical-muted">Άμεση κλινική επισκόπηση παρά την κλίνη</p>
              </div>
            </div>
            <ul className="space-y-1.5 text-sm text-slate-300">
              <li>• Εμφανής δύσπνοια, χρήση επικουρικών αναπνευστικών μυών.</li>
              <li>• Περιφερική κυάνωση χειλέων/ονύχων.</li>
              <li>• Ταχύπνοια (RR {state.vitals.rr}/min), διεγερτικότητα.</li>
            </ul>
          </div>
          <OptionButtons options={optionsHere} />
        </div>
      );

    case 'hs_ventilator':
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-clinical-border bg-black/40 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-clinical-green">Αναπνευστήρας — Ρυθμίσεις</p>
              <span className="rounded bg-clinical-green/10 px-2 py-0.5 font-mono text-[10px] text-clinical-green">
                MODE: ASSIST/CONTROL
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { k: 'FiO₂', v: state.flags['oxygen_adjusted'] ? '100%' : '40%' },
                { k: 'PEEP', v: '5 cmH₂O' },
                { k: 'RR set', v: '14/min' },
                { k: 'Vt', v: '450 mL' },
              ].map((x) => (
                <div key={x.k} className="rounded-lg border border-white/5 bg-clinical-panel2 p-2 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">{x.k}</p>
                  <p className="font-mono text-sm font-bold text-clinical-green">{x.v}</p>
                </div>
              ))}
            </div>
          </div>
          <OptionButtons options={optionsHere} />
        </div>
      );

    case 'hs_call':
      return (
        <div className="space-y-4">
          <div className="flex flex-col items-center rounded-xl border border-clinical-border bg-black/40 p-6 text-center">
            <span className="mb-2 text-5xl">🔔</span>
            <p className="font-semibold text-slate-100">Σύστημα Κλήσης Προσωπικού</p>
            <p className="mt-1 text-xs text-clinical-muted">
              Κλιμάκωση προς εφημερεύοντα ιατρό / ομάδα επείγουσας επέμβασης.
            </p>
          </div>
          <OptionButtons options={optionsHere} />
        </div>
      );

    case 'hs_ehr':
      return <EHRModal />;

    default:
      return <p className="text-slate-400">Άγνωστο στοιχείο.</p>;
  }
}

/* --------------------------- Live mini-vitals HUD ------------------------ */

function MiniVitals() {
  const { state } = useScenario();
  const alarm = state.monitorAlert;
  return (
    <div
      className={`absolute bottom-3 left-3 z-20 w-52 rounded-xl border bg-black/55 p-2.5 backdrop-blur-md ${
        alarm ? 'border-clinical-danger animate-pulse-glow-danger' : 'border-clinical-cyan/30'
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-widest text-slate-400">Live · Bed 1</span>
        <span className={`h-1.5 w-1.5 rounded-full ${alarm ? 'bg-clinical-danger animate-blink' : 'bg-clinical-green'}`} />
      </div>
      <WaveformCanvas kind="ecg" rate={state.vitals.hr} alarm={alarm} color="#34f5a0" height={34} />
      <div className="mt-1 flex items-center justify-between font-mono">
        <span className="text-sm font-bold text-clinical-green text-glow-green">
          {state.vitals.hr}
          <span className="ml-0.5 text-[9px] text-slate-500">HR</span>
        </span>
        <span
          className={`text-sm font-bold ${
            alarm ? 'text-clinical-danger text-glow-danger animate-blink' : 'text-clinical-cyan text-glow-cyan'
          }`}
        >
          {state.vitals.spo2}%
          <span className="ml-0.5 text-[9px] text-slate-500">SpO₂</span>
        </span>
      </div>
    </div>
  );
}

/* ------------------------------ Main view -------------------------------- */

const ACCENT_BY_HOTSPOT: Record<string, 'cyan' | 'green' | 'amber' | 'danger'> = {
  hs_monitor: 'cyan',
  hs_patient: 'green',
  hs_ventilator: 'green',
  hs_ehr: 'cyan',
  hs_call: 'amber',
};

export default function ICUWardView() {
  const { state, currentNode, openHotspot, closeHotspot, continueMessage, fireTimeout, reset } = useScenario();
  const scenario = state.scenario!;

  useAlarmSound(state.monitorAlert, true);

  // Ενεργά hotspots βάσει state (αρχικό ui.active_hotspots).
  const activeSet = new Set(scenario.initial_state.ui.active_hotspots);

  // Hotspots που πρέπει να λάμπουν (καθοδήγηση τρέχοντος κόμβου).
  const guidedHotspots = new Set<string>();
  if (currentNode?.type === 'decision') {
    for (const o of currentNode.options ?? []) guidedHotspots.add(o.target_hotspot);
  } else if (currentNode?.type === 'gate' && currentNode.gate_requirements) {
    guidedHotspots.add(currentNode.gate_requirements.target_hotspot);
  }

  const activeHotspot = state.activeHotspot;
  const hotspotLabel = (id: string) => scenario.hotspots.find((h) => h.id === id)?.label ?? id;
  const elapsedSec = state.startedAt ? Math.floor((Date.now() - state.startedAt) / 1000) : 0;

  const toneFor = (id: string): Tone => {
    if (id === 'hs_monitor' && state.monitorAlert) return 'danger';
    if (guidedHotspots.has(id)) return 'cyan';
    return 'idle';
  };

  return (
    <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-4">
      {/* ---------------------------- HUD bar ---------------------------- */}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-clinical-border bg-clinical-panel/70 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-clinical-cyan/15 text-lg">🏥</span>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-slate-100">{scenario.scenario_meta.title}</h1>
            <p className="font-mono text-[11px] text-clinical-muted">
              {scenario.scenario_meta.difficulty} · κόμβος {currentNode?.id ?? '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Stat label="Score" value={String(state.score)} accent={state.score >= 100 ? 'green' : state.score >= 70 ? 'cyan' : 'danger'} />
          <Stat label="Χρόνος" value={`${elapsedSec}s`} accent="cyan" />
          <Stat label="Events" value={String(state.log.length)} accent="cyan" />
          <button
            onClick={reset}
            className="ml-1 rounded-lg border border-clinical-border px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-clinical-danger/50 hover:text-clinical-danger"
          >
            ⟲ Reset
          </button>
        </div>
      </header>

      {/* Timeout bar (αν ο τρέχων κόμβος έχει timeout) */}
      {currentNode?.timeout && !activeHotspot && (
        <TimeoutBar seconds={currentNode.timeout.seconds} nodeId={currentNode.id} onExpire={fireTimeout} />
      )}

      {/* ----------------------------- Scene ----------------------------- */}
      <div
        className={`relative mx-auto w-full max-w-3xl flex-1 transition-all duration-300 ${
          activeHotspot ? 'pointer-events-none scale-[0.99] blur-md' : ''
        }`}
      >
        <div
          className="scanlines relative aspect-square w-full overflow-hidden rounded-2xl border border-clinical-border shadow-2xl"
          style={{
            backgroundColor: '#0a1120',
            backgroundImage:
              "linear-gradient(180deg, rgba(7,11,20,0.20) 0%, rgba(7,11,20,0.10) 40%, rgba(7,11,20,0.55) 100%), url('/icu-bg.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Ambient vignette για βάθος / XR vibe */}
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_140px_40px_rgba(0,0,0,0.55)]" />

          {/* Pulse-ring hotspots */}
          {scenario.hotspots.map((h) => {
            if (!activeSet.has(h.id)) return null; // ανενεργό βάσει state ⇒ κρυμμένο
            return (
              <PulseRing
                key={h.id}
                hotspotId={h.id}
                label={h.label}
                tone={toneFor(h.id)}
                onClick={() => openHotspot(h.id)}
              />
            );
          })}

          {/* Live mini-vitals overlay */}
          <MiniVitals />

          {/* Caption */}
          <div className="absolute bottom-3 right-3 z-20 rounded-full border border-clinical-border bg-black/50 px-3 py-1 text-[10px] uppercase tracking-widest text-clinical-muted">
            Θάλαμος ΜΕΘ · Κλίνη 1
          </div>
        </div>
      </div>

      {/* --------------------------- Briefing ---------------------------- */}
      <NodeBriefing onContinue={continueMessage} />

      {/* --------------------------- Focus Modal ------------------------- */}
      {activeHotspot && (
        <FocusModal
          title={hotspotLabel(activeHotspot)}
          subtitle={
            guidedHotspots.has(activeHotspot)
              ? 'Καθοδηγούμενη ενέργεια για τον τρέχοντα κόμβο'
              : 'Επισκόπηση στοιχείου'
          }
          accent={state.monitorAlert && activeHotspot === 'hs_monitor' ? 'danger' : ACCENT_BY_HOTSPOT[activeHotspot]}
          onClose={closeHotspot}
          widthClass={activeHotspot === 'hs_ehr' ? 'max-w-4xl' : 'max-w-2xl'}
        >
          <HotspotModalContent hotspotId={activeHotspot} />
        </FocusModal>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: 'cyan' | 'green' | 'danger' }) {
  const color =
    accent === 'green' ? 'text-clinical-green' : accent === 'danger' ? 'text-clinical-danger' : 'text-clinical-cyan';
  return (
    <div className="rounded-lg border border-clinical-border bg-black/30 px-3 py-1 text-center">
      <p className="text-[9px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`font-mono text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

function NodeBriefing({ onContinue }: { onContinue: () => void }) {
  const { state, currentNode } = useScenario();
  if (!currentNode) return null;

  const isDecision = currentNode.type === 'decision';
  const isGate = currentNode.type === 'gate';
  const isMessage = currentNode.type === 'message';

  return (
    <div
      className={`rounded-xl border bg-clinical-panel/70 p-4 backdrop-blur ${
        isGate ? 'border-clinical-amber/40' : 'border-clinical-border'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
            isGate
              ? 'bg-clinical-amber/15 text-clinical-amber'
              : isDecision
                ? 'bg-clinical-cyan/15 text-clinical-cyan'
                : 'bg-white/10 text-slate-300'
          }`}
        >
          {currentNode.type}
        </span>
        <div className="flex-1">
          <p className="text-sm text-slate-100">{currentNode.text}</p>
          {currentNode.description && <p className="mt-1 text-xs text-clinical-muted">{currentNode.description}</p>}

          {isDecision && (
            <p className="mt-2 text-xs text-clinical-cyan">
              ➔ Επίλεξε ενέργεια ανοίγοντας ένα από τα <span className="font-semibold">λαμπερά pulse rings</span>.
            </p>
          )}
          {isGate && (
            <p className="mt-2 text-xs text-clinical-amber">
              🔒 Άνοιξε το <span className="font-semibold">Τερματικό EHR</span> και συμπλήρωσε τα υποχρεωτικά πεδία.
            </p>
          )}

          {isMessage && (
            <button
              onClick={onContinue}
              className="mt-3 rounded-lg border border-clinical-cyan/50 bg-clinical-cyan/10 px-5 py-2 text-sm font-semibold text-clinical-cyan transition-all hover:bg-clinical-cyan/20 hover:shadow-glow"
            >
              Συνέχεια ➔
            </button>
          )}
        </div>
        {state.monitorAlert && (
          <span className="rounded-md border border-clinical-danger/50 bg-clinical-danger/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-clinical-danger animate-blink">
            SpO₂ Alarm
          </span>
        )}
      </div>
    </div>
  );
}
