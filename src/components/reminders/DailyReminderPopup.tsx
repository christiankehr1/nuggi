"use client";

import { useState, useSyncExternalStore } from "react";
import { BellIcon } from "@/components/icons";
import { Sheet } from "@/components/ui/Sheet";
import { useNow } from "@/hooks/useNow";
import { de } from "@/i18n/de";
import { pendingInAppReminders } from "@/lib/push/daily";
import { localDayKey } from "@/lib/time";
import type { DailyReminder } from "@/lib/types";

const CHECK_MS = 30_000;
const SNOOZE_MS = 30 * 60_000;
const ACK_PREFIX = "nuggi:daily-ack:";

function readAck(id: string): string | null {
  try {
    return localStorage.getItem(`${ACK_PREFIX}${id}`);
  } catch {
    return null;
  }
}

const noopSubscribe = () => () => {};

/**
 * In-app pop-up for daily reminders. Once a reminder's time has passed on the
 * current local day it is shown until someone taps "Erledigt" on this device
 * (acknowledgements live in localStorage, keyed by reminder and local day).
 * "Später" hides it for 30 minutes. Nothing renders before hydration so the
 * server and client markup match.
 */
export function DailyReminderPopup({ reminders, tz }: { reminders: DailyReminder[]; tz: string }) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const now = useNow(CHECK_MS);
  const [snoozed, setSnoozed] = useState<Record<string, number>>({});
  const [acked, setAcked] = useState<Record<string, string>>({});

  const day = localDayKey(now, tz);
  const current = mounted
    ? (pendingInAppReminders(reminders, now, tz).find((r) => {
        if ((snoozed[r.id] ?? 0) > now.getTime()) return false;
        return (acked[r.id] ?? readAck(r.id)) !== day;
      }) ?? null)
    : null;

  const later = () => {
    if (!current) return;
    setSnoozed((s) => ({ ...s, [current.id]: Date.now() + SNOOZE_MS }));
  };

  const done = () => {
    if (!current) return;
    try {
      localStorage.setItem(`${ACK_PREFIX}${current.id}`, day);
    } catch {
      /* private mode: the in-memory copy below still hides it for this session */
    }
    setAcked((a) => ({ ...a, [current.id]: day }));
  };

  if (reminders.length === 0) return null;

  return (
    <Sheet open={current !== null} onClose={later} title={de.dailyPopup.title}>
      {current ? (
        <div className="flex flex-col gap-4 pb-1">
          <div className="flex items-center gap-3 rounded-2xl bg-lavender-soft p-4">
            <BellIcon size={28} />
            <div className="flex min-w-0 flex-col">
              <span className="text-lg font-semibold">{current.name}</span>
              <span className="text-sm text-muted">{de.dailyPopup.body(current.name, current.time)}</span>
            </div>
          </div>
          <button type="button" className="btn btn-primary w-full text-lg" onClick={done} autoFocus>
            {de.dailyPopup.done}
          </button>
          <button type="button" className="btn btn-ghost w-full" onClick={later}>
            {de.dailyPopup.later}
          </button>
          <p className="text-center text-xs text-muted">{de.dailyPopup.laterHint}</p>
        </div>
      ) : null}
    </Sheet>
  );
}
