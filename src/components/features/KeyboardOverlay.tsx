'use client';

import { useEffect } from 'react';
import { useKeyboardNav } from '@/lib/keyboard';

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: '/', description: 'Focus search' },
      { keys: 'g \u2192 h', description: 'Go home' },
      { keys: 'g \u2192 s', description: 'Go to search' },
      { keys: 'g \u2192 l', description: 'Go to lists' },
      { keys: 'Esc', description: 'Go back / close' },
    ],
  },
  {
    title: 'Search Results',
    shortcuts: [
      { keys: 'j / k', description: 'Navigate results' },
      { keys: 'Enter', description: 'Open profile' },
      { keys: 's', description: 'Save developer' },
      { keys: 'e', description: 'Copy email' },
    ],
  },
  {
    title: 'Developer Profile',
    shortcuts: [
      { keys: 's', description: 'Save to list' },
      { keys: 'e', description: 'Copy email' },
      { keys: 'r', description: 'Generate scouting report' },
      { keys: 'o', description: 'Draft outreach' },
    ],
  },
];

export function KeyboardOverlay() {
  const { overlayOpen, setOverlayOpen } = useKeyboardNav();

  // Lock body scroll when overlay is open
  useEffect(() => {
    if (overlayOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [overlayOpen]);

  if (!overlayOpen) return null;

  // Check reduced motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => setOverlayOpen(false)}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm ${
          prefersReducedMotion ? '' : 'animate-in fade-in duration-200'
        }`}
      />

      {/* Card */}
      <div
        className={`relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8 ${
          prefersReducedMotion ? '' : 'animate-in zoom-in-95 fade-in duration-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-white">Keyboard Shortcuts</h2>
          <p className="text-sm text-gray-400 mt-1">Navigate GitScout like a pro</p>
        </div>

        <div className="space-y-6">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.keys}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-300">{shortcut.description}</span>
                    <kbd className="inline-flex items-center gap-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-gray-300">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700 text-center">
          <p className="text-xs text-gray-500">
            Press <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs font-mono">?</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}
