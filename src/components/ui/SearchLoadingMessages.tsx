"use client";

import { useEffect, useState } from "react";

const DEFAULT_MESSAGES = [
  "Scouting 100M+ profiles...",
  "Checking contribution graphs...",
  "Scoring merged pull requests...",
  "Hunting unicorns 🦄...",
  "Reading README quality...",
  "Counting green squares...",
  "Found some gems...",
];

interface SearchLoadingMessagesProps {
  isSearching: boolean;
  resultCount?: number;
  customMessages?: string[];
}

export function SearchLoadingMessages({
  isSearching,
  resultCount,
  customMessages,
}: SearchLoadingMessagesProps) {
  const messages = customMessages || DEFAULT_MESSAGES;
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [countDisplay, setCountDisplay] = useState(0);

  // Rotate messages
  useEffect(() => {
    if (!isSearching) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % messages.length);
        setVisible(true);
      }, 200);
    }, 2500);
    return () => clearInterval(interval);
  }, [isSearching, messages]);

  // Count up animation when done
  useEffect(() => {
    if (isSearching || !resultCount) return;
    const duration = 600;
    const start = performance.now();
    function animate(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      setCountDisplay(Math.round(progress * (resultCount ?? 0)));
      if (progress < 1) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }, [isSearching, resultCount]);

  if (!isSearching && resultCount !== undefined) {
    return (
      <div className="text-center">
        <p className="text-sm font-medium text-neutral-400">
          Found <span className="text-emerald-400 font-bold tabular-nums">{countDisplay.toLocaleString()}</span> developers
        </p>
      </div>
    );
  }

  if (!isSearching) return null;

  return (
    <div className="text-center space-y-3">
      <p
        className={`text-sm font-medium text-neutral-400 transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {messages[index]}
      </p>
      {/* Progress bar */}
      <div className="mx-auto h-0.5 w-48 overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full w-1/3 rounded-full animate-[indeterminate_1.5s_ease-in-out_infinite]"
          style={{ background: "#1D9E75" }}
        />
      </div>
      <style>{`
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
