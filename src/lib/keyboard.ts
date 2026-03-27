'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

const CHORD_TIMEOUT = 500;

interface KeyboardNavOptions {
  onToggleOverlay?: () => void;
  onNavigateResults?: (direction: 'next' | 'prev') => void;
  onSelectResult?: () => void;
  onSave?: () => void;
  onCopyEmail?: () => void;
  onReport?: () => void;
  onOutreach?: () => void;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardNav(options: KeyboardNavOptions = {}) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const chordRef = useRef<string | null>(null);
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleOverlay = useCallback(() => {
    setOverlayOpen((prev) => !prev);
    options.onToggleOverlay?.();
  }, [options]);

  useEffect(() => {
    // Respect prefers-reduced-motion for animations but still allow keyboard nav
    const handler = (e: KeyboardEvent) => {
      // Allow Escape to close overlay even when input is focused
      if (e.key === 'Escape') {
        if (overlayOpen) {
          setOverlayOpen(false);
          e.preventDefault();
          return;
        }
        // Close any open modal or go back
        return;
      }

      // Don't capture when typing in inputs
      if (isInputFocused()) return;

      // ? — toggle shortcuts overlay
      if (e.key === '?') {
        e.preventDefault();
        toggleOverlay();
        return;
      }

      // Handle chord second key
      if (chordRef.current === 'g') {
        chordRef.current = null;
        if (chordTimerRef.current) {
          clearTimeout(chordTimerRef.current);
          chordTimerRef.current = null;
        }

        switch (e.key) {
          case 'h':
            e.preventDefault();
            window.location.href = '/';
            return;
          case 's':
            e.preventDefault();
            window.location.href = '/search';
            return;
          case 'l':
            e.preventDefault();
            window.location.href = '/favorites';
            return;
        }
        return;
      }

      // g — start chord
      if (e.key === 'g') {
        e.preventDefault();
        chordRef.current = 'g';
        if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
        chordTimerRef.current = setTimeout(() => {
          chordRef.current = null;
        }, CHORD_TIMEOUT);

        // Show chord indicator
        showChordIndicator();
        return;
      }

      // / — focus search bar
      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[type="search"], input[name="search"], input[placeholder*="earch"], input[data-search]'
        );
        searchInput?.focus();
        return;
      }

      // j/k — navigate results
      if (e.key === 'j') {
        e.preventDefault();
        options.onNavigateResults?.('next');
        return;
      }
      if (e.key === 'k') {
        e.preventDefault();
        options.onNavigateResults?.('prev');
        return;
      }

      // Enter — select focused result
      if (e.key === 'Enter') {
        options.onSelectResult?.();
        return;
      }

      // s — save developer
      if (e.key === 's') {
        e.preventDefault();
        options.onSave?.();
        return;
      }

      // e — copy email
      if (e.key === 'e') {
        e.preventDefault();
        options.onCopyEmail?.();
        return;
      }

      // r — generate report
      if (e.key === 'r') {
        e.preventDefault();
        options.onReport?.();
        return;
      }

      // o — draft outreach
      if (e.key === 'o') {
        e.preventDefault();
        options.onOutreach?.();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
    };
  }, [overlayOpen, toggleOverlay, options]);

  return { overlayOpen, setOverlayOpen, toggleOverlay };
}

function showChordIndicator() {
  // Create a temporary floating indicator
  const existing = document.getElementById('scout-chord-indicator');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = 'scout-chord-indicator';
  el.textContent = 'g…';
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(139, 92, 246, 0.9)',
    color: 'white',
    padding: '6px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'monospace',
    fontWeight: '600',
    zIndex: '9999',
    backdropFilter: 'blur(8px)',
    transition: 'opacity 0.2s',
  });
  document.body.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }, CHORD_TIMEOUT);
}
