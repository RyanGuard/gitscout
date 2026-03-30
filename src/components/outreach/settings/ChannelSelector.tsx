"use client";

import { Mail, Smartphone, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Channel } from "./types";

// ─── Custom LinkedIn Icon (matches page.tsx) ───

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

// ─── Constants ───

const CHANNELS: { value: Channel; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "email", label: "Email", icon: Mail },
  { value: "linkedin", label: "LinkedIn", icon: LinkedinIcon },
  { value: "text", label: "Text", icon: Smartphone },
  { value: "multi_channel", label: "Multi", icon: Layers },
];

// ─── Props ───

interface ChannelSelectorProps {
  channel: Channel;
  onChange: (channel: Channel) => void;
}

// ─── Component ───

export function ChannelSelector({ channel, onChange }: ChannelSelectorProps) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-xs font-medium text-text-secondary">Channel</label>
      <div className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-surface p-0.5">
        {CHANNELS.map((ch) => {
          const Icon = ch.icon;
          return (
            <button
              key={ch.value}
              onClick={() => onChange(ch.value)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-md py-2 text-[10px] font-medium transition-colors",
                channel === ch.value ? "bg-gold text-white" : "text-text-muted hover:text-text"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {ch.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-text-dim">
        Try multi-channel — email first, then LinkedIn follow-up. Recruiters who mix channels get 2x more responses.
      </p>
    </div>
  );
}
