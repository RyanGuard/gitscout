"use client";

import { useState } from "react";
import type { ParsedRequirements } from "@/types";

interface RequirementsEditorProps {
  requirements: ParsedRequirements;
  onChange: (requirements: ParsedRequirements) => void;
  onSearch: () => void;
  loading: boolean;
}

function ChipGroup({
  label,
  items,
  onRemove,
  onAdd,
}: {
  label: string;
  items: string[];
  onRemove: (item: string) => void;
  onAdd: (item: string) => void;
}) {
  const [input, setInput] = useState("");

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      onAdd(input.trim());
      setInput("");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400 w-24 shrink-0">
        {label}
      </span>
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
        >
          {item}
          <button
            type="button"
            onClick={() => onRemove(item)}
            className="ml-0.5 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
            aria-label={`Remove ${item}`}
          >
            &times;
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`Add ${label.toLowerCase()}...`}
        className="w-32 rounded-full border border-dashed border-neutral-300 bg-transparent px-3 py-1 text-sm text-neutral-700 placeholder-neutral-400 focus:border-blue-400 focus:outline-none dark:border-neutral-600 dark:text-neutral-300 dark:placeholder-neutral-500"
      />
    </div>
  );
}

export function RequirementsEditor({
  requirements,
  onChange,
  onSearch,
  loading,
}: RequirementsEditorProps) {
  function updateField<K extends keyof ParsedRequirements>(
    field: K,
    value: ParsedRequirements[K]
  ) {
    onChange({ ...requirements, [field]: value });
  }

  function removeFromArray(field: "languages" | "frameworks" | "tools" | "keywords", item: string) {
    updateField(field, requirements[field].filter((i) => i !== item));
  }

  function addToArray(field: "languages" | "frameworks" | "tools" | "keywords", item: string) {
    if (!requirements[field].includes(item)) {
      updateField(field, [...requirements[field], item]);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Extracted Requirements
        </h2>
        <button
          type="button"
          onClick={onSearch}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Searching..." : "Find Matches"}
        </button>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Edit the extracted requirements below, then click Find Matches.
      </p>

      <div className="mt-5 space-y-3">
        <ChipGroup
          label="Languages"
          items={requirements.languages}
          onRemove={(item) => removeFromArray("languages", item)}
          onAdd={(item) => addToArray("languages", item)}
        />
        <ChipGroup
          label="Frameworks"
          items={requirements.frameworks}
          onRemove={(item) => removeFromArray("frameworks", item)}
          onAdd={(item) => addToArray("frameworks", item)}
        />
        <ChipGroup
          label="Tools"
          items={requirements.tools}
          onRemove={(item) => removeFromArray("tools", item)}
          onAdd={(item) => addToArray("tools", item)}
        />
        <ChipGroup
          label="Keywords"
          items={requirements.keywords}
          onRemove={(item) => removeFromArray("keywords", item)}
          onAdd={(item) => addToArray("keywords", item)}
        />

        {/* Inline fields for location, seniority, years */}
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Location
            </span>
            <input
              type="text"
              value={requirements.location || ""}
              onChange={(e) =>
                updateField("location", e.target.value || null)
              }
              placeholder="Any"
              className="w-36 rounded-lg border border-neutral-300 bg-transparent px-3 py-1.5 text-sm text-neutral-700 focus:border-blue-400 focus:outline-none dark:border-neutral-600 dark:text-neutral-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Seniority
            </span>
            <select
              value={requirements.seniority || ""}
              onChange={(e) =>
                updateField("seniority", e.target.value || null)
              }
              className="rounded-lg border border-neutral-300 bg-transparent px-3 py-1.5 text-sm text-neutral-700 focus:border-blue-400 focus:outline-none dark:border-neutral-600 dark:text-neutral-300"
            >
              <option value="">Any</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
              <option value="staff">Staff</option>
              <option value="principal">Principal</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Years
            </span>
            <input
              type="number"
              min={0}
              value={requirements.yearsExperience ?? ""}
              onChange={(e) =>
                updateField(
                  "yearsExperience",
                  e.target.value ? parseInt(e.target.value, 10) : null
                )
              }
              placeholder="Any"
              className="w-20 rounded-lg border border-neutral-300 bg-transparent px-3 py-1.5 text-sm text-neutral-700 focus:border-blue-400 focus:outline-none dark:border-neutral-600 dark:text-neutral-300"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
