"use client";

import { useState, useTransition } from "react";
import { endRunningAction } from "@/actions/events";
import { BreastIcon, MoonIcon } from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { useNow } from "@/hooks/useNow";
import { de } from "@/i18n/de";
import { submit } from "@/lib/client-submit";
import { eventDetail } from "@/lib/format";
import { fmtTime } from "@/lib/time";
import type { BabyEvent } from "@/lib/types";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function elapsedClock(from: string, now: Date): string {
  const secs = Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

interface RunningTimerProps {
  event: BabyEvent;
  tz: string;
  /** breast feeds: minutes after which the card turns amber and suggests switching sides */
  cueMinutes?: number | null;
}

/** Live timer card for a running sleep or feed with a single "Beenden" button. */
export function RunningTimer({ event, tz, cueMinutes = null }: RunningTimerProps) {
  const now = useNow(1000);
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [ended, setEnded] = useState(false);
  if (ended) return null;

  const isSleep = event.kind === "sleep";
  const elapsedMinutes = (now.getTime() - new Date(event.startedAt).getTime()) / 60_000;
  const cued = !isSleep && event.subtype === "breast" && cueMinutes !== null && elapsedMinutes >= cueMinutes;
  const tone = isSleep ? "text-lavender" : cued ? "text-sun" : "text-mint";
  const bg = isSleep ? "bg-lavender-soft" : cued ? "bg-sun-soft" : "bg-mint-soft";

  const end = () =>
    startTransition(async () => {
      const res = await submit("endRunning", endRunningAction, {
        babyId: event.babyId,
        kind: event.kind,
        endedAt: new Date().toISOString(),
      });
      if (res.ok || res.code === "offline") {
        setEnded(true);
        if (!res.ok) toast.show(res.error);
      } else {
        toast.show(res.error, { tone: "error" });
      }
    });

  return (
    <div className={`card flex items-center gap-4 p-4 ${bg}`}>
      <span className={`flex h-12 w-12 items-center justify-center rounded-full bg-navy-900/40 ${tone}`}>
        {isSleep ? <MoonIcon size={26} /> : <BreastIcon size={26} />}
      </span>
      <div className="flex-1">
        <p className="text-sm text-muted">
          {eventDetail(event)} · {de.actions.since} {fmtTime(event.startedAt, tz)}
        </p>
        <p className={`num text-3xl font-bold ${tone}`} aria-live="off">
          {elapsedClock(event.startedAt, now)}
        </p>
        {cued && cueMinutes !== null ? <p className="text-xs font-semibold text-sun">{de.actions.breastCue(cueMinutes)}</p> : null}
      </div>
      <button type="button" onClick={end} disabled={pending} className={`btn ${isSleep ? "btn-primary" : "btn-mint"} px-5`}>
        {de.actions.finish}
      </button>
    </div>
  );
}
