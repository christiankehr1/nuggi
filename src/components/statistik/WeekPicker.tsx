"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { de } from "@/i18n/de";

interface WeekPickerProps {
  weekStartKey: string;
  prevKey: string;
  nextKey: string | null;
  label: string;
  isCurrent: boolean;
}

/** Mo–So week picker with arrows; swipe left/right on the header switches weeks. */
export function WeekPicker({ prevKey, nextKey, label, isCurrent }: WeekPickerProps) {
  const router = useRouter();
  const touchX = useRef<number | null>(null);

  return (
    <div
      className="card flex items-center justify-between gap-2 p-2"
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start === null || end === undefined) return;
        const dx = end - start;
        if (dx > 60) router.push(`/statistik?week=${prevKey}`);
        else if (dx < -60 && nextKey) router.push(`/statistik?week=${nextKey}`);
      }}
    >
      <Link href={`/statistik?week=${prevKey}`} className="btn btn-ghost h-12 min-h-12 w-12 px-0" aria-label={de.stats.prevWeek}>
        <ChevronLeftIcon size={22} />
      </Link>
      <div className="text-center">
        <p className="num font-semibold">{label}</p>
        {isCurrent ? <p className="text-xs text-lavender">{de.stats.thisWeek}</p> : null}
      </div>
      {nextKey ? (
        <Link href={`/statistik?week=${nextKey}`} className="btn btn-ghost h-12 min-h-12 w-12 px-0" aria-label={de.stats.nextWeek}>
          <ChevronRightIcon size={22} />
        </Link>
      ) : (
        <span className="h-12 w-12" />
      )}
    </div>
  );
}
