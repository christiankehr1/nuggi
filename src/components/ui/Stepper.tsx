"use client";

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  presets?: number[];
}

/** Large ± stepper for millilitres, thumb-friendly. */
export function Stepper({ value, onChange, step = 10, min = 0, max = 500, unit = "ml", presets }: StepperProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="btn btn-secondary h-14 w-14 min-h-14 rounded-full px-0 text-2xl"
          onClick={() => onChange(clamp(value - step))}
          aria-label={`−${step} ${unit}`}
        >
          −
        </button>
        <div className="flex flex-1 items-baseline justify-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            className="num w-28 bg-transparent text-center text-5xl font-bold outline-none"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
            aria-label={unit}
          />
          <span className="text-lg text-muted">{unit}</span>
        </div>
        <button
          type="button"
          className="btn btn-secondary h-14 w-14 min-h-14 rounded-full px-0 text-2xl"
          onClick={() => onChange(clamp(value + step))}
          aria-label={`+${step} ${unit}`}
        >
          +
        </button>
      </div>
      {presets && presets.length > 0 ? (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(clamp(p))}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${
                p === value ? "bg-mint text-navy-900" : "bg-white/8 text-text"
              }`}
            >
              {p} {unit}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
