'use client';

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import confetti from 'canvas-confetti';
import { toast, Toaster } from 'sonner';

// ── localStorage state ──────────────────────────────────────

const STORAGE_KEY = 'scout_celebrations';

interface CelebrationState {
  firstUnicorn: boolean;
  firstExport: boolean;
  listMilestones: number[]; // milestones already celebrated
  lastActiveDates: string[]; // ISO date strings for streak tracking
}

function getState(): CelebrationState {
  if (typeof window === 'undefined') {
    return { firstUnicorn: false, firstExport: false, listMilestones: [], lastActiveDates: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { firstUnicorn: false, firstExport: false, listMilestones: [], lastActiveDates: [] };
}

function saveState(state: CelebrationState): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

// ── Reduced motion check ────────────────────────────────────

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── Confetti helpers ────────────────────────────────────────

function fireUnicornConfetti(): void {
  if (prefersReducedMotion()) return;
  // Purple + gold burst
  const colors = ['#a855f7', '#fbbf24', '#c084fc', '#f59e0b'];
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors,
    disableForReducedMotion: true,
  });
  // Second burst slightly delayed
  setTimeout(() => {
    confetti({
      particleCount: 40,
      spread: 100,
      origin: { y: 0.55, x: 0.6 },
      colors,
      disableForReducedMotion: true,
    });
  }, 150);
}

function fireMilestoneConfetti(): void {
  if (prefersReducedMotion()) return;
  confetti({
    particleCount: 40,
    spread: 60,
    origin: { y: 0.7 },
    colors: ['#60a5fa', '#34d399', '#a78bfa'],
    disableForReducedMotion: true,
  });
}

// ── Matrix rain animation ───────────────────────────────────

const SAMPLE_USERNAMES = [
  'torvalds', 'gaearon', 'sindresorhus', 'tj', 'mdo', 'yyx990803',
  'addyosmani', 'getify', 'kentcdodds', 'tpope', 'defunkt', 'mojombo',
  'jeresig', 'fat', 'paulirish', 'substack', 'isaacs', 'rauchg',
  'mrdoob', 'developit', 'antfu', 'egoist', 'paulmillr', 'Rich-Harris',
  'wycats', 'dhh', 'tenderlove', 'matz', 'guido', 'gvanrossum',
];

function startMatrixRain(durationMs: number = 3000): void {
  if (prefersReducedMotion()) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'scout-matrix-rain';
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '9999',
    pointerEvents: 'none',
  });
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  const fontSize = 14;
  const columns = Math.floor(canvas.width / (fontSize * 0.7));
  const drops: number[] = new Array(columns).fill(1);

  const interval = setInterval(() => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#22c55e';
    ctx.font = `${fontSize}px monospace`;

    for (let i = 0; i < drops.length; i++) {
      const text = SAMPLE_USERNAMES[Math.floor(Math.random() * SAMPLE_USERNAMES.length)];
      const char = text[Math.floor(Math.random() * text.length)];
      ctx.fillText(char, i * fontSize * 0.7, drops[i] * fontSize);

      if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  }, 40);

  setTimeout(() => {
    clearInterval(interval);
    // Fade out
    canvas.style.transition = 'opacity 0.5s';
    canvas.style.opacity = '0';
    setTimeout(() => canvas.remove(), 500);
  }, durationMs);
}

// ── Konami code detector ────────────────────────────────────

const KONAMI_SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
];

function useKonamiCode(onActivate: () => void) {
  const indexRef = useRef(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === KONAMI_SEQUENCE[indexRef.current]) {
        indexRef.current++;
        if (indexRef.current === KONAMI_SEQUENCE.length) {
          indexRef.current = 0;
          onActivate();
        }
      } else {
        indexRef.current = 0;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onActivate]);
}

// ── Context & Provider ──────────────────────────────────────

interface CelebrationContextType {
  celebrateUnicorn: () => void;
  celebrateMilestone: (count: number) => void;
  celebrateExport: () => void;
  celebrateStreak: (days: number) => void;
  recordActiveDay: () => void;
  getStreak: () => number;
}

const CelebrationContext = createContext<CelebrationContextType>({
  celebrateUnicorn: () => {},
  celebrateMilestone: () => {},
  celebrateExport: () => {},
  celebrateStreak: () => {},
  recordActiveDay: () => {},
  getStreak: () => 0,
});

export function useCelebration(): CelebrationContextType {
  return useContext(CelebrationContext);
}

const MILESTONE_THRESHOLDS = [10, 25, 50, 100];

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const celebrateUnicorn = useCallback(() => {
    const state = getState();
    if (state.firstUnicorn) return; // Already celebrated
    state.firstUnicorn = true;
    saveState(state);
    fireUnicornConfetti();
    toast('You found a unicorn!', {
      description: 'A 90+ score developer appeared in your results.',
      duration: 4000,
    });
  }, []);

  const celebrateMilestone = useCallback((count: number) => {
    const threshold = MILESTONE_THRESHOLDS.find((t) => t === count);
    if (!threshold) return;

    const state = getState();
    if (state.listMilestones.includes(threshold)) return;
    state.listMilestones.push(threshold);
    saveState(state);

    fireMilestoneConfetti();
    toast(`Your list just hit ${threshold} developers`, {
      description: 'Nice pipeline!',
      duration: 4000,
    });
  }, []);

  const celebrateExport = useCallback(() => {
    const state = getState();
    if (state.firstExport) return;
    state.firstExport = true;
    saveState(state);

    toast('Go get \'em.', {
      description: 'Your candidates are ready.',
      duration: 4000,
    });
  }, []);

  const recordActiveDay = useCallback(() => {
    const state = getState();
    const today = new Date().toISOString().slice(0, 10);
    if (!state.lastActiveDates.includes(today)) {
      state.lastActiveDates.push(today);
      // Keep only last 30 days
      if (state.lastActiveDates.length > 30) {
        state.lastActiveDates = state.lastActiveDates.slice(-30);
      }
      saveState(state);
    }
  }, []);

  const getStreak = useCallback((): number => {
    const state = getState();
    const dates = state.lastActiveDates.sort();
    if (dates.length === 0) return 0;

    let streak = 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if today or yesterday is in the list
    const todayStr = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (!dates.includes(todayStr) && !dates.includes(yesterdayStr)) return 0;

    // Count backwards from most recent date
    const startDate = dates.includes(todayStr) ? todayStr : yesterdayStr;
    let current = new Date(startDate);

    for (let i = 1; i < 30; i++) {
      current.setDate(current.getDate() - 1);
      const checkStr = current.toISOString().slice(0, 10);
      if (dates.includes(checkStr)) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }, []);

  const celebrateStreak = useCallback((days: number) => {
    if (days >= 3) {
      toast(`${days}-day scouting streak`, {
        description: 'Keep hunting.',
        duration: 4000,
      });
    }
  }, []);

  // Konami code easter egg
  const handleKonami = useCallback(() => {
    startMatrixRain(3000);
    toast("You found the secret.", {
      description: "You're clearly a 10x recruiter.",
      duration: 4000,
    });
  }, []);

  useKonamiCode(handleKonami);

  const value: CelebrationContextType = {
    celebrateUnicorn,
    celebrateMilestone,
    celebrateExport,
    celebrateStreak,
    recordActiveDay,
    getStreak,
  };

  return (
    <CelebrationContext value={value}>
      {children}
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: '#1f2937',
            border: '1px solid #374151',
            color: '#f3f4f6',
          },
        }}
      />
    </CelebrationContext>
  );
}
