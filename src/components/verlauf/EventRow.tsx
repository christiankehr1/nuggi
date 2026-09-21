"use client";

import { useState } from "react";
import { BottleIcon, BowlIcon, BreastIcon, MoonIcon, SunIcon } from "@/components/icons";
import { EditEventSheet } from "@/components/verlauf/EditEventSheet";
import { de } from "@/i18n/de";
import { durationLabel, eventDetail, eventDurationMinutes, timeRange } from "@/lib/format";
import type { BabyEvent } from "@/lib/types";

function iconFor(e: BabyEvent) {
  switch (e.subtype) {
    case "nap":
      return <SunIcon size={22} className="text-sun" />;
    case "night":
      return <MoonIcon size={22} className="text-lavender" />;
    case "breast":
      return <BreastIcon size={22} className="text-mint" />;
    case "bottle":
      return <BottleIcon size={22} className="text-mint" />;
    case "solids":
      return <BowlIcon size={22} className="text-mint" />;
  }
}

export function EventRow({ event, tz, now }: { event: BabyEvent; tz: string; now: string }) {
  const [open, setOpen] = useState(false);
  const mins = eventDurationMinutes(event, new Date(now));
  const showDuration = event.endedAt === null || mins > 0;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors active:bg-white/5"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/6">
          {iconFor(event)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{eventDetail(event)}</span>
          <span className="text-sm text-muted">
            {timeRange(event, tz)}
            {showDuration ? (
              <>
                {" · "}
                {event.endedAt === null ? de.events.runningLabel : durationLabel(mins)}
              </>
            ) : null}
          </span>
        </span>
        {event.memberName ? (
          <span className="shrink-0 text-xs text-muted/80">{de.events.loggedBy(event.memberName)}</span>
        ) : null}
      </button>
      <EditEventSheet open={open} onClose={() => setOpen(false)} babyId={event.babyId} tz={tz} existing={event} />
    </>
  );
}
