"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const STAGES = ["identified", "enriched", "contacted", "replied", "interested", "passed"] as const;

const STAGE_COLORS: Record<string, string> = {
  identified: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  enriched: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  contacted: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  replied: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  interested: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  passed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

interface StageDropdownProps {
  value: string;
  onChange: (stage: string) => void;
  disabled?: boolean;
}

export function StageDropdown({ value, onChange, disabled }: StageDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize transition-colors",
          STAGE_COLORS[value] || STAGE_COLORS.identified,
          !disabled && "cursor-pointer hover:opacity-80"
        )}
      >
        {value}
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-36 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            {STAGES.map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => {
                  onChange(stage);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs capitalize transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800",
                  stage === value && "font-semibold"
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", STAGE_COLORS[stage]?.split(" ")[0])} />
                {stage}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export { STAGE_COLORS, STAGES };
