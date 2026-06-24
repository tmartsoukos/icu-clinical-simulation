/**
 * VitalsMonitor.tsx
 * -----------------------------------------------------------------------------
 * Αναπαράσταση μόνιτορ ζωτικών λειτουργιών ΜΕΘ με ζωντανές κυματομορφές και
 * ψηφιακές τιμές (neon). Όταν υπάρχει alarm (SpO₂ < 90%) η οθόνη παίρνει κόκκινο
 * πλαίσιο που αναβοσβήνει. Χρησιμοποιείται τόσο στη σκηνή όσο και στο modal.
 * -----------------------------------------------------------------------------
 */

import type { Vitals } from '../types';
import WaveformCanvas from './WaveformCanvas';

interface VitalsMonitorProps {
  vitals: Vitals;
  alarm: boolean;
  compact?: boolean;
}

function VitalRow({
  label,
  value,
  unit,
  color,
  alarm,
}: {
  label: string;
  value: string | number;
  unit: string;
  color: string;
  alarm?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      <span className={`font-mono text-2xl font-bold ${color} ${alarm ? 'animate-blink' : ''}`}>
        {value}
        <span className="ml-1 text-xs text-slate-500">{unit}</span>
      </span>
    </div>
  );
}

export default function VitalsMonitor({ vitals, alarm, compact = false }: VitalsMonitorProps) {
  const spo2Color = alarm ? 'text-clinical-danger text-glow-danger' : 'text-clinical-cyan text-glow-cyan';

  return (
    <div
      className={`scanlines relative overflow-hidden rounded-xl border bg-black/80 ${
        alarm ? 'border-clinical-danger animate-pulse-glow-danger' : 'border-clinical-border'
      }`}
    >
      {/* Top status bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-black to-clinical-panel/60 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${alarm ? 'bg-clinical-danger animate-blink' : 'bg-clinical-green'}`} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">ICU · BED 1</span>
        </div>
        {alarm && (
          <span className="rounded bg-clinical-danger/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-clinical-danger animate-blink">
            ▲ ALARM
          </span>
        )}
      </div>

      <div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-[1fr_auto]'} gap-2 p-3`}>
        {/* Waveforms column */}
        <div className="flex flex-col gap-1.5">
          <div className="rounded-md border border-white/5 bg-black/60 px-2 py-1">
            <div className="mb-0.5 flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-widest text-clinical-green">ECG II</span>
              <span className="font-mono text-[9px] text-slate-600">{vitals.hr} bpm</span>
            </div>
            <WaveformCanvas kind="ecg" rate={vitals.hr} alarm={alarm} color="#34f5a0" height={compact ? 48 : 58} />
          </div>

          <div className="rounded-md border border-white/5 bg-black/60 px-2 py-1">
            <div className="mb-0.5 flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-widest text-clinical-cyan">PLETH SpO₂</span>
              <span className="font-mono text-[9px] text-slate-600">{vitals.spo2}%</span>
            </div>
            <WaveformCanvas
              kind="pleth"
              rate={vitals.hr}
              alarm={alarm}
              color="#22d3ee"
              height={compact ? 40 : 48}
            />
          </div>

          <div className="rounded-md border border-white/5 bg-black/60 px-2 py-1">
            <div className="mb-0.5 flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-widest text-clinical-amber">RESP</span>
              <span className="font-mono text-[9px] text-slate-600">{vitals.rr} /min</span>
            </div>
            <WaveformCanvas kind="resp" rate={vitals.rr} alarm={false} color="#fbbf24" height={compact ? 34 : 40} />
          </div>
        </div>

        {/* Digital values column */}
        <div
          className={`flex ${
            compact ? 'flex-row flex-wrap justify-between gap-x-4' : 'min-w-[150px] flex-col justify-between'
          } gap-2 rounded-md border border-white/5 bg-black/40 p-3`}
        >
          <VitalRow label="HR" value={vitals.hr} unit="bpm" color="text-clinical-green text-glow-green" />
          <VitalRow label="SpO₂" value={vitals.spo2} unit="%" color={spo2Color} alarm={alarm} />
          <VitalRow label="RR" value={vitals.rr} unit="/min" color="text-clinical-amber" />
          <VitalRow label="NIBP" value={vitals.bp} unit="mmHg" color="text-clinical-cyan text-glow-cyan" />
          <VitalRow label="Temp" value={vitals.temp.toFixed(1)} unit="°C" color="text-slate-200" />
        </div>
      </div>
    </div>
  );
}
