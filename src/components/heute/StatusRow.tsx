"use client";

import { useNow } from "@/hooks/useNow";
import { de } from "@/i18n/de";
import { elapsedLabel, eventDetail } from "@/lib/format";
import type { BabyEvent } from "@/lib/types";

interface StatusRowProps {
  awakeSince: string | null;
  lastFeed: BabyEvent | null;
}

/** "Wach seit 1 h 20 · Letzte Mahlzeit vor 2 h 10 (Fläschchen 120 ml)" */
export function StatusRow({ awakeSince, lastFeed }: StatusRowProps) {
  const now = useNow(30_000);
  const parts: string[] = [];
  if (awakeSince) parts.push(de.today.awakeSince(elapsedLabel(awakeSince, now)));
  if (lastFeed) parts.push(de.today.lastFeed(elapsedLabel(lastFeed.startedAt, now), eventDetail(lastFeed)));
  else parts.push(de.today.noFeedYet);
  return (
    <p className="text-center text-sm text-muted">
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 ? <span className="mx-1.5 opacity-60">·</span> : null}
          {p}
        </span>
      ))}
    </p>
  );
}
