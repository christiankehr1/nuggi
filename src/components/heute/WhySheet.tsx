"use client";

import { Sheet } from "@/components/ui/Sheet";
import { de } from "@/i18n/de";

export function WhySheet({ open, onClose, reasoning }: { open: boolean; onClose: () => void; reasoning: string[] }) {
  return (
    <Sheet open={open} onClose={onClose} title={de.today.whyTitle}>
      <p className="mb-3 text-sm text-muted">{de.today.whyIntro}</p>
      <ul className="flex flex-col gap-2 pb-1">
        {reasoning.map((line, i) => (
          <li key={i} className="flex gap-3 rounded-2xl bg-white/5 px-4 py-3 text-sm leading-snug">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-lavender" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-center text-xs text-muted/70">{de.app.disclaimer}</p>
      <button type="button" className="btn btn-secondary mt-3 w-full" onClick={onClose}>
        {de.common.ok}
      </button>
    </Sheet>
  );
}
