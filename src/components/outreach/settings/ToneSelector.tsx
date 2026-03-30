"use client";

import { cn } from "@/lib/utils";
import type { Tone } from "./types";

// ─── Constants ───

const TONES: { value: Tone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "technical_peer", label: "Technical Peer" },
  { value: "executive", label: "Executive" },
  { value: "warm_intro", label: "Warm Intro" },
];

// ─── Props ───

interface ToneSelectorProps {
  tone: Tone;
  onChange: (tone: Tone) => void;
}

// ─── Component ───

export function ToneSelector({ tone, onChange }: ToneSelectorProps) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-xs font-medium text-text-secondary">Tone</label>
      <div className="grid grid-cols-2 gap-1">
        {TONES.map((t) => (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={cn(
              "rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors",
              tone === t.value
                ? "border-gold bg-gold-bg text-gold"
                : "border-border text-text-muted hover:border-gold/30"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-text-dim">
        &quot;Technical peer&quot; works best for senior engineers. &quot;Casual&quot; works best for startup engineers.
      </p>
    </div>
  );
}
