/**
 * WaveformCanvas.tsx
 * -----------------------------------------------------------------------------
 * Ζωντανές κυματομορφές (HTML5 Canvas) που προσομοιώνουν καρδιογράφημα (ECG),
 * πληθυσμογράφημα οξυμέτρου (SpO₂/Pleth) και αναπνευστική καμπύλη (RR).
 * Όταν alarm = true (SpO₂ < 90%) οι γραμμές γίνονται παλλόμενες κόκκινες.
 * -----------------------------------------------------------------------------
 */

import { useEffect, useRef } from 'react';

export type WaveKind = 'ecg' | 'pleth' | 'resp';

interface WaveformCanvasProps {
  kind: WaveKind;
  /** Παλμοί/αναπνοές ανά λεπτό — ρυθμίζει τη συχνότητα της κυματομορφής. */
  rate: number;
  alarm: boolean;
  height?: number;
  className?: string;
  /** Βασικό χρώμα όταν δεν υπάρχει alarm. */
  color?: string;
}

/** Μορφή ενός κύκλου ECG (PQRST) σε κανονικοποιημένο πλάτος 0..1 → τιμή -1..1. */
function ecgSample(phase: number): number {
  // phase 0..1
  const p = phase;
  // P wave
  if (p < 0.12) return 0.12 * Math.sin((p / 0.12) * Math.PI);
  // PR segment
  if (p < 0.18) return 0;
  // Q
  if (p < 0.22) return -0.18 * ((p - 0.18) / 0.04);
  // R (sharp spike up)
  if (p < 0.26) return -0.18 + 1.18 * ((p - 0.22) / 0.04);
  // S (sharp down)
  if (p < 0.31) return 1.0 - 1.45 * ((p - 0.26) / 0.05);
  // ST segment
  if (p < 0.42) return -0.45 + 0.45 * ((p - 0.31) / 0.11);
  // T wave
  if (p < 0.62) return 0.3 * Math.sin(((p - 0.42) / 0.2) * Math.PI);
  return 0;
}

/** Πληθυσμογράφημα: γρήγορη ανάβαση, αργή κάθοδος, δικρωτική εντομή. */
function plethSample(phase: number): number {
  const p = phase;
  if (p < 0.18) return Math.sin((p / 0.18) * (Math.PI / 2));
  const d = (p - 0.18) / 0.82;
  const base = Math.cos(d * (Math.PI / 2));
  const dicrotic = 0.12 * Math.exp(-Math.pow((p - 0.45) / 0.06, 2));
  return Math.max(0, base + dicrotic);
}

/** Αναπνευστική καμπύλη: ομαλό ημιτονοειδές. */
function respSample(phase: number): number {
  return Math.sin(phase * Math.PI * 2) * 0.85;
}

function sampleFor(kind: WaveKind, phase: number): number {
  switch (kind) {
    case 'ecg':
      return ecgSample(phase);
    case 'pleth':
      return plethSample(phase) * 2 - 1; // map 0..1 → -1..1
    case 'resp':
      return respSample(phase);
  }
}

export default function WaveformCanvas({
  kind,
  rate,
  alarm,
  height = 70,
  className = '',
  color = '#34f5a0',
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  // Σταθερά refs ώστε ο βρόχος animation να μη χρειάζεται restart σε κάθε render.
  const rateRef = useRef(rate);
  const alarmRef = useRef(alarm);
  const colorRef = useRef(color);
  rateRef.current = rate;
  alarmRef.current = alarm;
  colorRef.current = color;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.clientWidth;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      width = canvas.clientWidth;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Ιστορικό σημείων (sweep buffer).
    const points: number[] = new Array(Math.ceil(width)).fill(0);
    let phase = 0;
    let last = performance.now();

    const speedPxPerSec = 90; // ταχύτητα σάρωσης
    let carry = 0;

    const draw = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      const cyclesPerSec = Math.max(0.2, rateRef.current / 60);
      // Πόσα νέα pixels να προστεθούν αυτό το frame.
      carry += speedPxPerSec * dt;
      const steps = Math.floor(carry);
      carry -= steps;

      for (let i = 0; i < steps; i++) {
        phase += (cyclesPerSec / speedPxPerSec);
        if (phase >= 1) phase -= 1;
        points.push(sampleFor(kind, phase));
        if (points.length > Math.ceil(width)) points.shift();
      }

      // Render
      ctx.clearRect(0, 0, width, height);

      // Grid baseline
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      const isAlarm = alarmRef.current;
      const pulse = isAlarm ? 0.55 + 0.45 * Math.abs(Math.sin(now / 180)) : 1;
      const stroke = isAlarm ? `rgba(255, 59, 78, ${pulse})` : colorRef.current;

      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.shadowBlur = isAlarm ? 16 : 10;
      ctx.shadowColor = stroke;
      ctx.lineJoin = 'round';
      ctx.beginPath();

      const amp = height * 0.34;
      const mid = height / 2;
      const n = points.length;
      for (let x = 0; x < n; x++) {
        const y = mid - points[x] * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Leading dot
      if (n > 0) {
        const ly = mid - points[n - 1] * amp;
        ctx.fillStyle = stroke;
        ctx.beginPath();
        ctx.arc(n - 1, ly, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [kind, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height }}
      className={className}
      aria-label={`waveform-${kind}`}
    />
  );
}
