"use client";

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? "bg-lavender" : "bg-white/15"}`}
      >
        <span
          className={`absolute top-1 left-0 h-6 w-6 rounded-full bg-white transition-transform ${
            checked ? "translate-x-7" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}
