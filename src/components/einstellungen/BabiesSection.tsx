"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { BabyForm } from "@/components/einstellungen/BabyForm";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { de } from "@/i18n/de";
import { ageLabel } from "@/lib/age";
import type { Baby } from "@/lib/types";

export function BabiesSection({ babies, tz }: { babies: Baby[]; tz: string }) {
  const params = useSearchParams();
  const [editing, setEditing] = useState<Baby | null>(null);
  // `?baby=neu` (from the empty Heute state) opens the form on first render.
  const [open, setOpen] = useState(() => params.get("baby") === "neu");
  const [now] = useState(() => new Date());

  return (
    <section className="card flex flex-col gap-2 p-5">
      <h2 className="text-sm font-medium text-muted">{de.settings.babies}</h2>
      <ul className="flex flex-col">
        {babies.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => {
                setEditing(b);
                setOpen(true);
              }}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-2 text-left active:bg-white/5"
            >
              <span>
                <span className="font-semibold">{b.name}</span>
                <span className="ml-2 text-sm text-muted">{ageLabel(b.birthDate, now, tz)}</span>
              </span>
              <ChevronRightIcon size={20} className="text-muted" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-secondary w-full"
        onClick={() => {
          setEditing(null);
          setOpen(true);
        }}
      >
        <PlusIcon size={20} />
        {de.settings.addBaby}
      </button>
      <BabyForm open={open} onClose={() => setOpen(false)} existing={editing} />
    </section>
  );
}
