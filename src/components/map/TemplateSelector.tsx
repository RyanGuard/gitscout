"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Save, Loader2 } from "lucide-react";

interface Template {
  id: string;
  name: string;
  tone: string;
  sellingPoints: string[];
  customInstructions: string | null;
}

interface TemplateSelectorProps {
  onLoad: (template: {
    tone: string;
    sellingPoints: string;
    customInstructions: string;
  }) => void;
  currentTone: string;
  currentSellingPoints: string;
  currentCustomInstructions: string;
}

export function TemplateSelector({
  onLoad,
  currentTone,
  currentSellingPoints,
  currentCustomInstructions,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/market-map/outreach-templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
      setLoaded(true);
    }
    load();
  }, []);

  async function saveAsTemplate() {
    const name = prompt("Template name:");
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/market-map/outreach-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          tone: currentTone,
          selling_points: currentSellingPoints
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          custom_instructions: currentCustomInstructions || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates((prev) => [data.template, ...prev]);
      }
    } finally {
      setSaving(false);
    }
  }

  function loadTemplate(t: Template) {
    onLoad({
      tone: t.tone,
      sellingPoints: t.sellingPoints.join("\n"),
      customInstructions: t.customInstructions || "",
    });
    setOpen(false);
  }

  if (!loaded) return null;

  return (
    <div className="flex items-center gap-2 mb-4">
      {/* Load template dropdown */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-700/50 px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 transition-colors"
        >
          Load template
          <ChevronDown className="h-3 w-3" />
        </button>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <div className="absolute left-0 top-8 z-50 w-56 rounded-lg border border-neutral-700/50 bg-neutral-900 p-1 shadow-xl">
              {templates.length === 0 ? (
                <div className="px-3 py-2 text-xs text-neutral-500">
                  No saved templates
                </div>
              ) : (
                templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => loadTemplate(t)}
                    className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-neutral-800/50 transition-colors"
                  >
                    <div className="font-medium text-white">{t.name}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      {t.tone} · {t.sellingPoints.length} selling points
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Save as template */}
      <button
        onClick={saveAsTemplate}
        disabled={saving}
        className="flex items-center gap-1.5 rounded-lg border border-neutral-700/50 px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 transition-colors"
      >
        {saving ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Save className="h-3 w-3" />
        )}
        Save as template
      </button>
    </div>
  );
}
