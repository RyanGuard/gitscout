'use client';

import { createContext, useContext } from 'react';

const STORAGE_KEY = 'gitscout_sound_enabled';

type OscillatorType = 'sine' | 'square' | 'triangle' | 'sawtooth';

interface NoteConfig {
  frequency: number;
  type: OscillatorType;
  startTime: number;
  duration: number;
  gainStart: number;
  gainEnd: number;
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private _enabled: boolean = false;
  private _prefersReducedMotion: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this._enabled = localStorage.getItem(STORAGE_KEY) === 'true';
      this._prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
        this._prefersReducedMotion = e.matches;
      });
    }
  }

  get enabled(): boolean {
    return this._enabled && !this._prefersReducedMotion;
  }

  get rawEnabled(): boolean {
    return this._enabled;
  }

  toggle(): boolean {
    this._enabled = !this._enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(this._enabled));
    }
    return this._enabled;
  }

  setEnabled(value: boolean): void {
    this._enabled = value;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(value));
    }
  }

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx || this.ctx.state === 'closed') {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private playNotes(notes: NoteConfig[], masterVolume: number = 0.2): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(ctx.destination);

    const now = ctx.currentTime;

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = note.type;
      osc.frequency.value = note.frequency;

      gain.gain.setValueAtTime(note.gainStart, now + note.startTime);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(note.gainEnd, 0.001),
        now + note.startTime + note.duration
      );

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + note.startTime);
      osc.stop(now + note.startTime + note.duration);
    }
  }

  /** Soft whoosh — swept sine wave, 200ms */
  playSearch(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.2;
    masterGain.connect(ctx.destination);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /** Signature unicorn ping — two-note ascending chime with reverb, 300ms */
  playUnicorn(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.2;
    masterGain.connect(ctx.destination);

    // Create a convolver for subtle reverb
    const convolver = ctx.createConvolver();
    const reverbLength = ctx.sampleRate * 0.5;
    const impulse = ctx.createBuffer(1, reverbLength, ctx.sampleRate);
    const impulseData = impulse.getChannelData(0);
    for (let i = 0; i < reverbLength; i++) {
      impulseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1));
    }
    convolver.buffer = impulse;

    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.15;
    convolver.connect(reverbGain);
    reverbGain.connect(masterGain);

    // Note 1: E5 (659 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 659;
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    gain1.connect(convolver);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Note 2: A5 (880 Hz) — starts slightly after
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 880;
    gain2.gain.setValueAtTime(0.001, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.5, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    gain2.connect(convolver);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.35);

    // Harmonic shimmer on second note
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.value = 1760;
    gain3.gain.setValueAtTime(0.001, now + 0.1);
    gain3.gain.linearRampToValueAtTime(0.1, now + 0.12);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc3.connect(gain3);
    gain3.connect(masterGain);
    gain3.connect(convolver);
    osc3.start(now + 0.1);
    osc3.stop(now + 0.3);
  }

  /** Soft pop — quick bubble, 100ms */
  playSave(): void {
    this.playNotes([
      { frequency: 400, type: 'sine', startTime: 0, duration: 0.05, gainStart: 0.4, gainEnd: 0.2 },
      { frequency: 600, type: 'sine', startTime: 0.02, duration: 0.08, gainStart: 0.3, gainEnd: 0.001 },
    ]);
  }

  /** Subtle mechanical click, 50ms */
  playCopy(): void {
    this.playNotes([
      { frequency: 1200, type: 'square', startTime: 0, duration: 0.02, gainStart: 0.15, gainEnd: 0.001 },
      { frequency: 800, type: 'square', startTime: 0.02, duration: 0.03, gainStart: 0.1, gainEnd: 0.001 },
    ]);
  }

  /** Soft complete chime — three ascending notes, 400ms */
  playComplete(): void {
    this.playNotes([
      { frequency: 523, type: 'sine', startTime: 0, duration: 0.2, gainStart: 0.3, gainEnd: 0.05 },
      { frequency: 659, type: 'sine', startTime: 0.12, duration: 0.2, gainStart: 0.3, gainEnd: 0.05 },
      { frequency: 784, type: 'sine', startTime: 0.24, duration: 0.25, gainStart: 0.35, gainEnd: 0.001 },
    ]);
  }

  /** Warm success tone, 300ms */
  playExport(): void {
    this.playNotes([
      { frequency: 440, type: 'triangle', startTime: 0, duration: 0.15, gainStart: 0.3, gainEnd: 0.1 },
      { frequency: 554, type: 'triangle', startTime: 0.08, duration: 0.15, gainStart: 0.3, gainEnd: 0.1 },
      { frequency: 659, type: 'sine', startTime: 0.15, duration: 0.2, gainStart: 0.35, gainEnd: 0.001 },
    ]);
  }
}

// Singleton
let engineInstance: SoundEngine | null = null;
export function getSoundEngine(): SoundEngine {
  if (!engineInstance) {
    engineInstance = new SoundEngine();
  }
  return engineInstance;
}

// React context
export interface SoundContextType {
  enabled: boolean;
  toggle: () => void;
  playSearch: () => void;
  playUnicorn: () => void;
  playSave: () => void;
  playCopy: () => void;
  playComplete: () => void;
  playExport: () => void;
}

export const SoundContext = createContext<SoundContextType>({
  enabled: false,
  toggle: () => {},
  playSearch: () => {},
  playUnicorn: () => {},
  playSave: () => {},
  playCopy: () => {},
  playComplete: () => {},
  playExport: () => {},
});

export function useSound(): SoundContextType {
  return useContext(SoundContext);
}
