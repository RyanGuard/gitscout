"use client";

// ─── Props ───

interface SequenceLengthSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

// ─── Component ───

export function SequenceLengthSlider({ value, onChange, min = 1, max = 5 }: SequenceLengthSliderProps) {
  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="mb-3">
      <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-text-secondary">
        <span>Sequence length</span>
        <span className="font-bold text-gold">{value}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-gold"
      />
      <div className="flex justify-between text-[9px] text-text-dim">
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  );
}
