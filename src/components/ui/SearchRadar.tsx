"use client";

import { useEffect, useState } from "react";

interface SearchRadarProps {
  isSearching: boolean;
  resultsFound: number;
}

export function SearchRadar({ isSearching, resultsFound }: SearchRadarProps) {
  const [dots, setDots] = useState<{ x: number; y: number; id: number }[]>([]);

  // Random layout must not run during render (react-hooks/purity); defer with microtask.
  useEffect(() => {
    if (!isSearching || resultsFound === 0) {
      queueMicrotask(() => setDots([]));
      return;
    }
    const count = Math.min(resultsFound, 12);
    queueMicrotask(() => {
      setDots(
        Array.from({ length: count }, (_, i) => ({
          x: 15 + Math.random() * 70,
          y: 15 + Math.random() * 70,
          id: i,
        }))
      );
    });
  }, [isSearching, resultsFound]);

  return (
    <div className="relative mx-auto" style={{ width: 120, height: 120 }}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Grid circles */}
        {[20, 35, 50].map((r) => (
          <circle
            key={r}
            cx="50" cy="50" r={r}
            fill="none"
            className="stroke-neutral-700/30"
            strokeWidth="0.3"
          />
        ))}
        {/* Crosshairs */}
        <line x1="50" y1="0" x2="50" y2="100" className="stroke-neutral-700/20" strokeWidth="0.3" />
        <line x1="0" y1="50" x2="100" y2="50" className="stroke-neutral-700/20" strokeWidth="0.3" />

        {/* Sweep line */}
        {isSearching && (
          <line
            x1="50" y1="50" x2="50" y2="2"
            stroke="var(--gold)"
            strokeWidth="0.8"
            opacity="0.8"
            className="origin-center animate-[spin_2s_linear_infinite]"
            style={{ transformOrigin: "50px 50px" }}
          />
        )}

        {/* Result dots */}
        {dots.map((dot) => (
          <g key={dot.id}>
            <circle
              cx={dot.x} cy={dot.y} r="2"
              fill="var(--gold)"
              className="animate-[ping_1s_ease-out_1]"
              opacity="0.3"
            />
            <circle
              cx={dot.x} cy={dot.y} r="1.5"
              fill="var(--gold)"
              className="animate-[pulse_2s_ease-in-out_infinite]"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
