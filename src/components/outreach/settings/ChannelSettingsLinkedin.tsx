"use client";

import { cn } from "@/lib/utils";
import { SequenceLengthSlider } from "./SequenceLengthSlider";

// ─── Props ───

interface ChannelSettingsLinkedinProps {
  seqLength: number;
  onSeqLengthChange: (value: number) => void;
  viewFirst: boolean;
  onViewFirstChange: (value: boolean) => void;
  likePost: boolean;
  onLikePostChange: (value: boolean) => void;
  firstTouch: "connect" | "inmail";
  onFirstTouchChange: (value: "connect" | "inmail") => void;
}

// ─── Component ───

export function ChannelSettingsLinkedin({
  seqLength,
  onSeqLengthChange,
  viewFirst,
  onViewFirstChange,
  likePost,
  onLikePostChange,
  firstTouch,
  onFirstTouchChange,
}: ChannelSettingsLinkedinProps) {
  return (
    <div>
      {/* Sequence length */}
      <SequenceLengthSlider value={seqLength} onChange={onSeqLengthChange} min={1} max={4} />

      {/* View profile first toggle */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-text-secondary">View profile first</p>
          <p className="text-[10px] text-text-dim">Visit their profile before sending</p>
        </div>
        <button
          onClick={() => onViewFirstChange(!viewFirst)}
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors",
            viewFirst ? "bg-gold" : "bg-border"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
              viewFirst ? "left-[18px]" : "left-0.5"
            )}
          />
        </button>
      </div>

      {/* Like a recent post toggle */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-text-secondary">Like a recent post</p>
          <p className="text-[10px] text-text-dim">Warm up before connecting</p>
        </div>
        <button
          onClick={() => onLikePostChange(!likePost)}
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors",
            likePost ? "bg-gold" : "bg-border"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
              likePost ? "left-[18px]" : "left-0.5"
            )}
          />
        </button>
      </div>

      {/* Connection request vs InMail */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-text-secondary">First touch</label>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-0.5">
          <button
            onClick={() => onFirstTouchChange("connect")}
            className={cn(
              "rounded-md py-1.5 text-[11px] font-medium transition-colors",
              firstTouch === "connect"
                ? "border-gold bg-gold-bg text-gold"
                : "text-text-muted hover:text-text"
            )}
          >
            Connect
          </button>
          <button
            onClick={() => onFirstTouchChange("inmail")}
            className={cn(
              "rounded-md py-1.5 text-[11px] font-medium transition-colors",
              firstTouch === "inmail"
                ? "border-gold bg-gold-bg text-gold"
                : "text-text-muted hover:text-text"
            )}
          >
            InMail
          </button>
        </div>
        <p className="mt-1 text-[10px] text-text-dim">
          Connection notes are limited to 200 characters
        </p>
      </div>

      {/* Agent badge */}
      <div className="mt-4 rounded-lg border border-gold-border bg-gold-bg px-3 py-2">
        <p className="text-[11px] font-semibold text-gold">Requires GitScout Agent</p>
        <p className="mt-0.5 text-[10px] text-text-dim">
          LinkedIn actions are queued and executed by the GitScout Agent browser extension.
        </p>
      </div>
    </div>
  );
}
