"use client";

import { AlertCircle } from "lucide-react";
import { SequenceLengthSlider } from "./SequenceLengthSlider";

// ─── Props ───

interface ChannelSettingsTextProps {
  seqLength: number;
  onSeqLengthChange: (value: number) => void;
}

// ─── Component ───

export function ChannelSettingsText({ seqLength, onSeqLengthChange }: ChannelSettingsTextProps) {
  return (
    <div>
      {/* Sequence length */}
      <SequenceLengthSlider value={seqLength} onChange={onSeqLengthChange} min={1} max={3} />

      {/* 160-char limit callout */}
      <div className="mb-3 flex items-start gap-2 rounded-lg border border-gold-border bg-gold-bg px-3 py-2">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
        <div>
          <p className="text-[11px] font-medium text-gold">160-character limit</p>
          <p className="mt-0.5 text-[10px] text-text-dim">
            SMS messages are limited to 160 characters per segment. Messages over this limit will be split into multiple texts and may cost more.
          </p>
        </div>
      </div>
    </div>
  );
}
