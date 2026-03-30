"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateItem } from "./types";

// ─── Props ───

interface TemplatesSectionProps {
  templates: TemplateItem[];
  showTemplates: boolean;
  onToggleTemplates: () => void;
  onLoadTemplate: (template: TemplateItem) => void;
}

// ─── Component ───

export function TemplatesSection({
  templates,
  showTemplates,
  onToggleTemplates,
  onLoadTemplate,
}: TemplatesSectionProps) {
  return (
    <div className="mb-5">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-3">Templates</h3>
      {templates.length > 0 && (
        <div className="relative mb-2">
          <button
            onClick={onToggleTemplates}
            className="w-full flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-gold/30"
          >
            <span>Load template</span>
            <ChevronDown className={cn("h-3 w-3 transition-transform", showTemplates && "rotate-180")} />
          </button>
          {showTemplates && (
            <div className="absolute z-10 top-full mt-1 w-full rounded-lg border border-border bg-surface shadow-lg max-h-48 overflow-y-auto">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onLoadTemplate(t)}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-surface-secondary border-b border-border last:border-0"
                >
                  <span className="font-medium text-text">{t.name}</span>
                  {t.responseRate !== null && (
                    <span className="ml-2 text-success">{Math.round(t.responseRate * 100)}% response</span>
                  )}
                  <p className="text-text-muted truncate">{t.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="text-[10px] text-text-dim">
        Save your best sequences as templates. Scout tracks which templates get the highest response rates.
      </p>
    </div>
  );
}
