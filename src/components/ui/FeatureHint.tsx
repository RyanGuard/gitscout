"use client";

import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "scout_dismissed_hints";

function getDismissedHints(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function dismissHint(id: string) {
  const dismissed = getDismissedHints();
  dismissed.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed]));
}

interface FeatureHintProps {
  id: string;
  message: string;
  position?: "top" | "bottom" | "left" | "right";
}

export function FeatureHint({ id, message, position = "bottom" }: FeatureHintProps) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [pulsed, setPulsed] = useState(false);
  const dotRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Check if dismissed or if onboarding is active
    const dismissed = getDismissedHints();
    const onboardingActive = localStorage.getItem("scout_onboarding_active") === "true";
    if (dismissed.has(id) || onboardingActive) return;
    setVisible(true);

    // Pulse once on mount, then static
    const timer = setTimeout(() => setPulsed(true), 1500);
    return () => clearTimeout(timer);
  }, [id]);

  if (!visible) return null;

  function handleDismiss() {
    dismissHint(id);
    setOpen(false);
    setVisible(false);
  }

  const positionClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses: Record<string, string> = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-neutral-800 border-x-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-neutral-800 border-x-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-neutral-800 border-y-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-neutral-800 border-y-transparent border-l-transparent",
  };

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={dotRef}
        onClick={() => setOpen(!open)}
        className="relative flex h-4 w-4 items-center justify-center"
        aria-label="Feature tip"
      >
        <span
          className={`h-2 w-2 rounded-full bg-gold ${!pulsed ? "animate-ping" : ""}`}
          style={{ position: "absolute" }}
        />
        <span className="relative h-2 w-2 rounded-full bg-gold" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={handleDismiss} />
          <div
            className={`absolute z-50 w-56 rounded-lg border border-neutral-700/50 bg-neutral-800 p-3 shadow-xl ${positionClasses[position]}`}
          >
            <div className={`absolute h-0 w-0 border-[6px] ${arrowClasses[position]}`} />
            <p className="text-xs leading-relaxed text-neutral-200">{message}</p>
            <button
              onClick={handleDismiss}
              className="mt-2 text-[10px] font-medium text-gold hover:text-gold-hover transition-colors"
            >
              Got it
            </button>
          </div>
        </>
      )}
    </span>
  );
}
