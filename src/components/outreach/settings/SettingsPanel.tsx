"use client";

import { Minus } from "lucide-react";
import { ChannelSelector } from "./ChannelSelector";
import { ToneSelector } from "./ToneSelector";
import { SequenceLengthSlider } from "./SequenceLengthSlider";
import { ActionsSection } from "./ActionsSection";
import { TemplatesSection } from "./TemplatesSection";
import { IntelligenceSection } from "./IntelligenceSection";
import { SuggestionsSection } from "./SuggestionsSection";
import type { Channel, Tone, AnalyticsData, TemplateItem, SuggestionsData } from "./types";

// ─── Props ───

interface SettingsPanelProps {
  // Channel
  channel: Channel;
  onChannelChange: (channel: Channel) => void;
  // Tone
  tone: Tone;
  onToneChange: (tone: Tone) => void;
  // Sequence length
  seqLength: number;
  onSeqLengthChange: (value: number) => void;
  // Role info
  roleTitle: string;
  onRoleTitleChange: (value: string) => void;
  roleCompany: string;
  onRoleCompanyChange: (value: string) => void;
  // Selling points
  sellingPoints: string[];
  onSellingPointsChange: (points: string[]) => void;
  // Actions
  onGenerate: () => void;
  onRewrite: () => void;
  onImprove: () => void;
  onRegenerateStep: (step: number) => void;
  generating: boolean;
  rewriting: boolean;
  improving: boolean;
  hasMessages: boolean;
  canGenerate: boolean;
  activeStep: number;
  // Templates
  templates: TemplateItem[];
  showTemplates: boolean;
  onToggleTemplates: () => void;
  onLoadTemplate: (template: TemplateItem) => void;
  // Intelligence
  analytics: AnalyticsData | null;
  // Suggestions
  suggestions: SuggestionsData | null;
  loadingSuggestions: boolean;
  onGetSuggestions: () => void;
  onApplySuggestions: () => void;
  showForCandidate: boolean;
}

// ─── Component ───

export function SettingsPanel({
  channel,
  onChannelChange,
  tone,
  onToneChange,
  seqLength,
  onSeqLengthChange,
  roleTitle,
  onRoleTitleChange,
  roleCompany,
  onRoleCompanyChange,
  sellingPoints,
  onSellingPointsChange,
  onGenerate,
  onRewrite,
  onImprove,
  onRegenerateStep,
  generating,
  rewriting,
  improving,
  hasMessages,
  canGenerate,
  activeStep,
  templates,
  showTemplates,
  onToggleTemplates,
  onLoadTemplate,
  analytics,
  suggestions,
  loadingSuggestions,
  onGetSuggestions,
  onApplySuggestions,
  showForCandidate,
}: SettingsPanelProps) {
  return (
    <div className="w-[300px] shrink-0 border-l border-border overflow-y-auto bg-surface-secondary p-4">
      {/* Section 1: Settings */}
      <div className="mb-5">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-3">Settings</h3>

        <ChannelSelector channel={channel} onChange={onChannelChange} />
        <ToneSelector tone={tone} onChange={onToneChange} />
        <SequenceLengthSlider value={seqLength} onChange={onSeqLengthChange} />

        {/* Role info */}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-text-secondary">Role title</label>
          <input
            value={roleTitle}
            onChange={(e) => onRoleTitleChange(e.target.value)}
            placeholder="e.g. Sr. Frontend Engineer"
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-gold"
          />
        </div>
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-text-secondary">Company</label>
          <input
            value={roleCompany}
            onChange={(e) => onRoleCompanyChange(e.target.value)}
            placeholder="Your company name"
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-gold"
          />
        </div>

        {/* Selling points */}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-text-secondary">Selling points</label>
          {sellingPoints.map((sp, i) => (
            <div key={i} className="flex items-center gap-1 mb-1">
              <input
                value={sp}
                onChange={(e) => {
                  const next = [...sellingPoints];
                  next[i] = e.target.value;
                  onSellingPointsChange(next);
                }}
                placeholder="What's compelling?"
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-gold"
              />
              {sellingPoints.length > 1 && (
                <button
                  onClick={() => onSellingPointsChange(sellingPoints.filter((_, j) => j !== i))}
                  className="text-text-dim hover:text-danger"
                >
                  <Minus className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => onSellingPointsChange([...sellingPoints, ""])}
            className="text-[10px] font-medium text-gold hover:text-gold-hover"
          >
            + Add point
          </button>
          <p className="mt-1 text-[10px] text-text-dim">
            Lead with what&apos;s compelling for THEM, not what your company needs. Remote work? Founding team? Interesting technical challenge?
          </p>
        </div>
      </div>

      {/* Section 2: Actions */}
      <ActionsSection
        onGenerate={onGenerate}
        onRewrite={onRewrite}
        onImprove={onImprove}
        onRegenerateStep={onRegenerateStep}
        generating={generating}
        rewriting={rewriting}
        improving={improving}
        hasMessages={hasMessages}
        canGenerate={canGenerate}
        activeStep={activeStep}
      />

      {/* Section 3: Templates */}
      <TemplatesSection
        templates={templates}
        showTemplates={showTemplates}
        onToggleTemplates={onToggleTemplates}
        onLoadTemplate={onLoadTemplate}
      />

      {/* Section 4: Intelligence */}
      <IntelligenceSection analytics={analytics} />

      {/* Section 5: Suggestions */}
      <SuggestionsSection
        suggestions={suggestions}
        loadingSuggestions={loadingSuggestions}
        onGetSuggestions={onGetSuggestions}
        onApplySuggestions={onApplySuggestions}
        showForCandidate={showForCandidate}
      />
    </div>
  );
}
