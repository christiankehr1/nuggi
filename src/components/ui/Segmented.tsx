"use client";

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  tone?: "lavender" | "sun" | "coral" | "mint";
  label?: string;
}

const toneClass: Record<NonNullable<SegmentedProps<string>["tone"]>, string> = {
  lavender: "bg-lavender text-navy-900",
  sun: "bg-sun text-navy-900",
  coral: "bg-coral text-navy-900",
  mint: "bg-mint text-navy-900",
};

export function Segmented<T extends string>({ value, onChange, options, tone = "lavender", label }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-2xl bg-white/6 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-semibold transition-colors ${
              active ? toneClass[tone] : "text-muted"
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
