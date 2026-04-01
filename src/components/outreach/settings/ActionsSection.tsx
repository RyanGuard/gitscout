"use client";

import { Loader2, RefreshCw, Sparkles, Zap, FlaskConical } from "lucide-react";

// ─── Props ───

interface ActionsSectionProps {
  onGenerate: () => void;
  onRewrite: () => void;
  onImprove: () => void;
  onRegenerateStep: (step: number) => void;
  onGenerateVariant?: () => void;
  generating: boolean;
  rewriting: boolean;
  improving: boolean;
  generatingVariant?: boolean;
  hasMessages: boolean;
  canGenerate: boolean;
  activeStep: number;
}

// ─── Component ───

export function ActionsSection({
  onGenerate,
  onRewrite,
  onImprove,
  onRegenerateStep,
  onGenerateVariant,
  generating,
  rewriting,
  improving,
  generatingVariant,
  hasMessages,
  canGenerate,
  activeStep,
}: ActionsSectionProps) {
  return (
    <div className="mb-5">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-3">Actions</h3>

      <button
        onClick={onGenerate}
        disabled={generating || !canGenerate}
        className="w-full rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate sequence
          </>
        )}
      </button>

      {hasMessages && (
        <div className="mt-2 space-y-1.5">
          <button
            onClick={onRewrite}
            disabled={rewriting}
            className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {rewriting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Rewrite this message
          </button>
          <button
            onClick={onImprove}
            disabled={improving}
            className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {improving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            Improve this message
          </button>
          <p className="text-[10px] text-text-dim">
            Paste your own draft and click Improve — Scout keeps your voice but makes it sharper
          </p>
          <button
            onClick={() => onRegenerateStep(activeStep)}
            className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="h-3 w-3" />
            Regenerate this step
          </button>
          {onGenerateVariant && (
            <button
              onClick={onGenerateVariant}
              disabled={generatingVariant}
              className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {generatingVariant ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />}
              Generate Variant
            </button>
          )}
        </div>
      )}
    </div>
  );
}
