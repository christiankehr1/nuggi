"use client";

import { useTransition } from "react";
import { selectBabyAction } from "@/actions/babies";
import type { Baby } from "@/lib/types";

export function BabySwitcher({ babies, selectedId }: { babies: Baby[]; selectedId: string }) {
  const [pending, startTransition] = useTransition();
  if (babies.length < 2) return null;
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto" role="tablist" aria-label="Baby wählen">
      {babies.map((b) => {
        const active = b.id === selectedId;
        return (
          <button
            key={b.id}
            role="tab"
            aria-selected={active}
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => void (await selectBabyAction({ babyId: b.id })))}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors ${
              active ? "bg-lavender text-navy-900" : "bg-white/8 text-muted"
            }`}
          >
            {b.name}
          </button>
        );
      })}
    </div>
  );
}
