/**
 * useAlarmSound.ts
 * -----------------------------------------------------------------------------
 * Ακουστικός συναγερμός μέσω Web Audio API. Παράγει επαναλαμβανόμενο διπλό beep
 * όσο το `active` είναι true. Δεν απαιτεί εξωτερικά αρχεία ήχου.
 * (Το AudioContext ξεκινά μόνο μετά από user gesture λόγω πολιτικών browser.)
 * -----------------------------------------------------------------------------
 */

import { useEffect, useRef } from 'react';

export function useAlarmSound(active: boolean, enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !enabled) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!ctxRef.current) ctxRef.current = new AudioCtx();
    const audioCtx = ctxRef.current;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => undefined);
    }

    const beep = (freq: number, start: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + start);
      osc.stop(audioCtx.currentTime + start + duration + 0.02);
    };

    const playPattern = () => {
      beep(880, 0, 0.12);
      beep(880, 0.18, 0.12);
    };

    playPattern();
    timerRef.current = window.setInterval(playPattern, 1100);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, enabled]);

  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => undefined);
        ctxRef.current = null;
      }
    };
  }, []);
}
