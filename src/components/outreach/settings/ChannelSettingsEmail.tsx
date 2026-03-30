"use client";

import { SequenceLengthSlider } from "./SequenceLengthSlider";

// ─── Props ───

interface ChannelSettingsEmailProps {
  seqLength: number;
  onSeqLengthChange: (value: number) => void;
}

// ─── Component ───

export function ChannelSettingsEmail({ seqLength, onSeqLengthChange }: ChannelSettingsEmailProps) {
  return (
    <div>
      {/* Sequence length */}
      <SequenceLengthSlider value={seqLength} onChange={onSeqLengthChange} min={1} max={5} />

      {/* Subject line guide */}
      <div className="mb-3 rounded-lg border border-border bg-surface px-3 py-2">
        <p className="text-[11px] font-medium text-text-secondary">Subject line tips</p>
        <ul className="mt-1 space-y-0.5 text-[10px] text-text-dim">
          <li>Keep it under 50 characters for mobile</li>
          <li>Personalize with their name or company</li>
          <li>Avoid spam triggers like &quot;free&quot; or &quot;urgent&quot;</li>
          <li>Ask a question or reference their work</li>
        </ul>
      </div>
    </div>
  );
}
