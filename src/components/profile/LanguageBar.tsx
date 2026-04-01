import { getLanguageColor } from "@/lib/utils";
import type { LanguageStat } from "@/types";

interface LanguageBarProps {
  languages: LanguageStat[];
}

export function LanguageBar({ languages }: LanguageBarProps) {
  if (!languages || languages.length === 0) return null;

  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        {languages.map((lang) => (
          <div
            key={lang.language}
            className="transition-all"
            style={{
              width: `${lang.percentage}%`,
              backgroundColor: getLanguageColor(lang.language),
            }}
            title={`${lang.language}: ${lang.percentage.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {languages.map((lang) => (
          <div key={lang.language} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: getLanguageColor(lang.language) }}
            />
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              {lang.language}
            </span>
            <span className="text-neutral-500">{lang.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
