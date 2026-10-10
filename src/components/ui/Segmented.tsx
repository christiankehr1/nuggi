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
  // Four or more icon + label pills don't fit side by side on a phone, so the
  // icon moves above the label to keep every option inside the bar.
  const stacked = options.length >= 4 && options.some((o) => o.icon);
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
            className={`flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-xl font-semibold transition-colors ${
              stacked ? "flex-col gap-0.5 px-1 py-1.5 text-xs" : "gap-1.5 px-2 text-sm"
            } ${active ? toneClass[tone] : "text-muted"}`}
          >
            {o.icon}
            <span className="max-w-full truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
