/**
 * ICUWardView.tsx
 * -----------------------------------------------------------------------------
 * Κύρια οθόνη προσομοίωσης (Focus-Based / Direct Manipulation).
 * Ευθυγραμμισμένο με τη ΝΕΑ εικόνα φόντου (/icu-bg.png — landscape 11:6) που
 * περιλαμβάνει: δύο μεγάλες οθόνες (τερματικό σε βραχίονα κέντρο-αριστερά &
 * μεγάλη κονσόλα τοίχου δεξιά) και αναπνευστήρα τέρμα αριστερά.
 *
 * Άμεσος Χειρισμός (Direct Manipulation):
 *  - Οι ΟΘΟΝΕΣ (hs_monitor, hs_ehr) κάνουν render LIVE περιεχόμενο μέσα στο
 *    bounding box τους (κινούμενα HTML5 Canvas waveforms / EHR mini-interface).
 *  - Τα ΜΗ-οθόνες hotspots (hs_patient, hs_ventilator, hs_call) εμφανίζονται ως
 *    ημιδιαφανή "Pulse Rings" με ιατρικά SVG icons που κάνουν ping όταν είναι
 *    guided (Recognition rather than Recall).
 *  - Με SpO₂ < 90% (Alarm) το πλαίσιο της οθόνης τοίχου κάνει έντονο κόκκινο
 *    παλλόμενο flash (animate-pulse ring-4 ring-red-600).
 * -----------------------------------------------------------------------------
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useScenario } from '../context/ScenarioContext';
import { useAlarmSound } from '../hooks/useAlarmSound';
import type { DecisionOption, Vitals } from '../types';
import EHRModal from './EHRModal';
import FocusModal from './FocusModal';
import HelpModal from './HelpModal';
import VitalsMonitor from './VitalsMonitor';
import WaveformCanvas from './WaveformCanvas';

/* ============================================================================
 * CONFIGURABLE COORDINATES
 * ----------------------------------------------------------------------------
 * Bounding boxes (σε ΠΟΣΟΣΤΑ % πάνω στην εικόνα φόντου). Μικρο-ρύθμισε εδώ τις
 * τιμές top/left/width/height αν χρειαστεί pixel-perfect ευθυγράμμιση.
 * Αναφορά εικόνας: landscape 2816×1536 (11:6).
 * ==========================================================================*/
interface BBox {
  top: string;
  left: string;
  width: string;
  height: string;
}

const HOTSPOT_POSITIONS: Record<string, BBox> = {
  // ΑΡΙΣΤΕΡΗ μεγάλη οθόνη τοίχου → LIVE EHR terminal.
  hs_ehr: { top: '10.0%', left: '22.3%', width: '27.5%', height: '36.0%' },

  // ΔΕΞΙΑ μεγάλη οθόνη τοίχου → LIVE μόνιτορ ζωτικών.
  hs_monitor: { top: '10.0%', left: '50.1%', width: '27.5%', height: '36.0%' },

  // Ιατρικός εξοπλισμός / αντλίες (αριστερός τοίχος) → Αναπνευστήρας.
  hs_ventilator: { top: '46.0%', left: '12.5%', width: '4.5%', height: '8.5%' },

  // Περιοχή κλίνης/κρεβατιού (κάτω-αριστερά) → Ασθενής.
  hs_patient: { top: '60.0%', left: '11.0%', width: '35.0%', height: '38.0%' },

  // Κουμπί κλήσης στη σιδηροτροχιά της κλίνης → μικρό pulse ring.
  hs_call: { top: '52.0%', left: '44.0%', width: '3.0%', height: '5.5%' },
};

/* --------------------------- Medical icons (SVG) ------------------------- */

const ICONS: Record<string, ReactNode> = {
  hs_monitor: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h3l2-5 3 9 2-6 1.5 2H21" />
    </svg>
  ),
  hs_patient: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8v10M3 13h18v5M21 18v-4a3 3 0 0 0-3-3h-7v3" />
      <circle cx="7" cy="10" r="1.6" />
    </svg>
  ),
  hs_ventilator: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v8" />
      <path d="M9 7c0 4-2 5-3.5 6.5C4 15 5 20 7.5 20S10 18 10 15v-4a2 2 0 0 0-1-2Z" />
      <path d="M15 7c0 4 2 5 3.5 6.5C20 15 19 20 16.5 20S14 18 14 15v-4a2 2 0 0 1 1-2Z" />
    </svg>
  ),
  hs_ehr: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4h6v3H9zM9 12h6M9 16h4" />
    </svg>
  ),
  hs_call: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  ),
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

/* ====================== Embedded LIVE wall monitor ======================= */

function EmbeddedMonitor({ vitals, alarm, guided }: { vitals: Vitals; alarm: boolean; guided: boolean }) {
  return (
    <div
      className={`scanlines absolute inset-0 flex flex-col overflow-hidden rounded-[6px] border bg-black/92 text-left transition-all ${
        alarm
          ? 'border-red-600 ring-4 ring-red-600 animate-pulse'
          : guided
            ? 'border-clinical-cyan/70 ring-2 ring-clinical-cyan/60 animate-pulse-glow'
            : 'border-white/15'
      } group-hover:brightness-125`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-black to-clinical-panel/50 px-2 py-[3px]">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${alarm ? 'bg-red-500 animate-blink' : 'bg-clinical-green'}`} />
          <span className="font-mono text-[8px] uppercase tracking-widest text-slate-400">ICU MONITOR · BED 1</span>
        </span>
        {alarm && (
          <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-red-400 animate-blink">▲ ALARM</span>
        )}
      </div>

      {/* Waveforms + values */}
      <div className="grid flex-1 grid-cols-[1fr_auto] gap-1 p-1.5">
        <div className="flex min-w-0 flex-col justify-center gap-1">
          <div className="rounded-sm border border-white/5 bg-black/70 px-1">
            <WaveformCanvas kind="ecg" rate={vitals.hr} alarm={alarm} color="#34f5a0" height={34} />
          </div>
          <div className="rounded-sm border border-white/5 bg-black/70 px-1">
            <WaveformCanvas kind="pleth" rate={vitals.hr} alarm={alarm} color="#22d3ee" height={26} />
          </div>
          <div className="rounded-sm border border-white/5 bg-black/70 px-1">
            <WaveformCanvas kind="resp" rate={vitals.rr} alarm={false} color="#fbbf24" height={20} />
          </div>
        </div>

        <div className="flex min-w-[54px] flex-col justify-center gap-0.5 rounded-sm border border-white/5 bg-black/50 px-1.5 py-1 font-mono leading-none">
          <Readout label="HR" value={vitals.hr} color="text-clinical-green" />
          <Readout
            label="SpO₂"
            value={vitals.spo2}
            color={alarm ? 'text-red-500 animate-blink' : 'text-clinical-cyan'}
          />
          <Readout label="RR" value={vitals.rr} color="text-clinical-amber" />
          <Readout label="NIBP" value={vitals.bp} color="text-slate-200" small />
        </div>
      </div>
    </div>
  );
}

function Readout({
  label,
  value,
  color,
  small,
}: {
  label: string;
  value: string | number;
  color: string;
  small?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <span className="text-[7px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`${small ? 'text-[10px]' : 'text-sm'} font-bold ${color}`}>{value}</span>
    </div>
  );
}

/* ======================= Embedded LIVE EHR terminal ===================== */

function EmbeddedEHR({ guided }: { guided: boolean }) {
  return (
    <div
      className={`scanlines absolute inset-0 flex flex-col overflow-hidden rounded-[6px] border bg-black/90 p-1.5 text-left transition-all ${
        guided
          ? 'border-clinical-cyan/70 ring-2 ring-clinical-cyan/60 animate-pulse-glow'
          : 'border-white/15'
      } group-hover:brightness-125`}
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-1">
        <span className="font-mono text-[8px] uppercase tracking-widest text-clinical-cyan">e-Health · EHR</span>
        <span className="text-clinical-cyan/80">{ICONS.hs_ehr && <span className="block h-2.5 w-2.5">{ICONS.hs_ehr}</span>}</span>
      </div>

      {/* Faux trend sparkline (όπως το γράφημα της εικόνας) */}
      <svg viewBox="0 0 100 26" preserveAspectRatio="none" className="my-1 h-6 w-full">
        <polyline
          points="0,18 12,14 22,16 34,8 46,12 58,5 70,11 82,7 100,10"
          fill="none"
          stroke="#34f5a0"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Field placeholders */}
      <div className="flex flex-1 flex-col justify-center gap-1">
        {['Αξιολόγηση', 'Παρέμβαση', 'Επικοινωνία'].map((t) => (
          <div key={t} className="flex items-center gap-1">
            <span className="w-[42%] truncate text-[7px] text-slate-500">{t}</span>
            <span className="h-1.5 flex-1 rounded-sm bg-white/10" />
          </div>
        ))}
      </div>

      <div
        className={`mt-1 rounded-sm px-1 py-0.5 text-center font-mono text-[7px] uppercase tracking-widest ${
          guided ? 'bg-clinical-cyan/20 text-clinical-cyan animate-blink' : 'bg-white/5 text-slate-400'
        }`}
      >
        ▶ Έτοιμο για καταχώρηση
      </div>
    </div>
  );
}

/* ------------------------------- Pulse Ring ------------------------------ */

type Tone = 'cyan' | 'idle';

function RingMarker({ hotspotId, label, tone }: { hotspotId: string; label: string; tone: Tone }) {
  const palette: Record<Tone, { ring: string; ping: string; text: string; core: string }> = {
    cyan: {
      ring: 'border-clinical-cyan/80',
      ping: 'bg-clinical-cyan/40',
      text: 'text-clinical-cyan',
      core: 'bg-clinical-cyan/15',
    },
    idle: {
      ring: 'border-slate-300/45',
      ping: '',
      text: 'text-slate-200',
      core: 'bg-white/5',
    },
  };
  const c = palette[tone];
  const active = tone !== 'idle';

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="relative flex h-14 w-14 items-center justify-center">
        {active && <span className={`absolute inline-flex h-full w-full rounded-full ${c.ping} animate-ping`} />}
        <span
          className={`absolute inline-flex h-full w-full rounded-full border-2 ${c.ring} ${
            active ? 'shadow-glow animate-pulse-glow' : ''
          } backdrop-blur-[2px] transition-transform group-hover:scale-110`}
        />
        <span
          className={`relative flex h-8 w-8 items-center justify-center rounded-full ${c.core} ${c.text} transition-transform group-hover:scale-110`}
        >
          <span className="h-5 w-5">{ICONS[hotspotId]}</span>
        </span>
      </span>

      {/* Hover label chip */}
      <span
        className={`absolute left-1/2 top-[78%] -translate-x-1/2 whitespace-nowrap rounded-md border border-clinical-border bg-clinical-bg/90 px-2 py-0.5 text-[11px] font-medium ${c.text} opacity-0 shadow-lg backdrop-blur transition-opacity duration-200 group-hover:opacity-100`}
      >
        {label}
      </span>

      {active && (
        <span className="absolute right-[34%] top-[28%] h-2.5 w-2.5 rounded-full bg-clinical-cyan shadow-glow" />
      )}
    </div>
  );
}

/* --------------------------- Screen label chip --------------------------- */

function ScreenTag({ text, tone }: { text: string; tone: 'cyan' | 'danger' }) {
  return (
    <span
      className={`pointer-events-none absolute -top-2 left-2 z-10 rounded border px-1.5 py-[1px] font-mono text-[8px] uppercase tracking-widest backdrop-blur ${
        tone === 'danger'
          ? 'border-red-600/60 bg-red-950/70 text-red-300'
          : 'border-clinical-cyan/40 bg-clinical-bg/80 text-clinical-cyan'
      }`}
    >
      {text}
    </span>
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

  const [soundOn, setSoundOn] = useState(() => {
    try {
      return localStorage.getItem('icu_sound') !== 'off';
    } catch {
      return true;
    }
  });
  const [showHelp, setShowHelp] = useState(false);

  const toggleSound = () =>
    setSoundOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('icu_sound', next ? 'on' : 'off');
      } catch {
        /* ignore storage errors */
      }
      return next;
    });

  useAlarmSound(state.monitorAlert, soundOn);

  // Ενεργά hotspots βάσει state (αρχικό ui.active_hotspots).
  const activeSet = new Set(scenario.initial_state.ui.active_hotspots);

  // Hotspots που πρέπει να καθοδηγούν την προσοχή του χρήστη.
  const guidedHotspots = new Set<string>();
  if (currentNode?.type === 'decision') {
    for (const o of currentNode.options ?? []) guidedHotspots.add(o.target_hotspot);
  } else if (currentNode?.type === 'gate' && currentNode.gate_requirements) {
    guidedHotspots.add(currentNode.gate_requirements.target_hotspot);
  }

  const activeHotspot = state.activeHotspot;
  const hotspotLabel = (id: string) => scenario.hotspots.find((h) => h.id === id)?.label ?? id;
  const elapsedSec = state.startedAt ? Math.floor((Date.now() - state.startedAt) / 1000) : 0;

  const renderHotspotContent = (id: string, guided: boolean): ReactNode => {
    if (id === 'hs_monitor') return <EmbeddedMonitor vitals={state.vitals} alarm={state.monitorAlert} guided={guided} />;
    if (id === 'hs_ehr') return <EmbeddedEHR guided={guided} />;
    return <RingMarker hotspotId={id} label={hotspotLabel(id)} tone={guided ? 'cyan' : 'idle'} />;
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
            onClick={toggleSound}
            title={soundOn ? 'Σίγαση συναγερμού' : 'Ενεργοποίηση ήχου'}
            aria-label={soundOn ? 'Σίγαση συναγερμού' : 'Ενεργοποίηση ήχου'}
            className={`ml-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              soundOn
                ? 'border-clinical-border text-slate-300 hover:border-clinical-cyan/50 hover:text-clinical-cyan'
                : 'border-clinical-amber/50 text-clinical-amber'
            }`}
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
          <button
            onClick={() => setShowHelp(true)}
            title="Οδηγίες & Βοήθεια"
            aria-label="Οδηγίες & Βοήθεια"
            className="rounded-lg border border-clinical-border px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-clinical-cyan/50 hover:text-clinical-cyan"
          >
            ? Βοήθεια
          </button>
          <button
            onClick={reset}
            className="rounded-lg border border-clinical-border px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-clinical-danger/50 hover:text-clinical-danger"
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
        className={`relative mx-auto w-full max-w-5xl flex-1 transition-all duration-300 ${
          activeHotspot ? 'pointer-events-none scale-[0.99] blur-md' : ''
        }`}
      >
        <div
          className="relative aspect-[11/6] w-full overflow-hidden rounded-2xl border border-clinical-border shadow-2xl"
          style={{
            backgroundColor: '#0a1120',
            backgroundImage:
              "linear-gradient(180deg, rgba(7,11,20,0.18) 0%, rgba(7,11,20,0.05) 45%, rgba(7,11,20,0.45) 100%), url('/icu-bg.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Ambient vignette για βάθος / XR vibe */}
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_36px_rgba(0,0,0,0.5)]" />

          {/* Hotspots (screens → live render, others → pulse rings) */}
          {scenario.hotspots.map((h) => {
            if (!activeSet.has(h.id)) return null; // ανενεργό βάσει state ⇒ κρυμμένο
            const pos = HOTSPOT_POSITIONS[h.id];
            if (!pos) return null;
            const guided = guidedHotspots.has(h.id);
            const isScreen = h.id === 'hs_monitor' || h.id === 'hs_ehr';
            const monitorAlarm = h.id === 'hs_monitor' && state.monitorAlert;

            return (
              <button
                key={h.id}
                onClick={() => openHotspot(h.id)}
                aria-label={h.label}
                title={h.label}
                style={{ top: pos.top, left: pos.left, width: pos.width, height: pos.height }}
                className="group absolute z-20 cursor-pointer outline-none transition-transform duration-200 hover:z-30 hover:scale-[1.03]"
              >
                {isScreen && (
                  <ScreenTag
                    text={h.id === 'hs_monitor' ? 'MONITOR' : 'EHR'}
                    tone={monitorAlarm ? 'danger' : 'cyan'}
                  />
                )}
                {renderHotspotContent(h.id, guided)}
              </button>
            );
          })}

          {/* Caption */}
          <div className="pointer-events-none absolute bottom-2 right-3 z-10 rounded-full border border-clinical-border bg-black/45 px-3 py-1 text-[10px] uppercase tracking-widest text-clinical-muted">
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

      {/* On-line Help */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
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
              ➔ Επίλεξε ενέργεια κάνοντας κλικ σε ένα από τα <span className="font-semibold">φωτισμένα στοιχεία</span> της σκηνής.
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
