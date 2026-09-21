"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  createEventAction,
  deleteEventAction,
  endRunningAction,
  logFeedAction,
  restoreEventAction,
  startBreastFeedAction,
  startSleepAction,
  updateEventAction,
} from "@/actions/events";
import {
  createMeasurementAction,
  deleteMeasurementAction,
  restoreMeasurementAction,
  updateMeasurementAction,
} from "@/actions/measurements";
import { useToast } from "@/components/ui/Toast";
import { de } from "@/i18n/de";
import type { ActionResult } from "@/lib/action-result";
import { registerOutbox, type OutboxActionName } from "@/lib/client-submit";
import { enqueueOutbox, outboxCount, replayOutbox } from "@/lib/offline/outbox";

const ACTIONS: Record<OutboxActionName, (input: unknown) => Promise<ActionResult<unknown>>> = {
  startSleep: startSleepAction,
  startBreastFeed: startBreastFeedAction,
  endRunning: endRunningAction,
  logFeed: logFeedAction,
  createEvent: createEventAction,
  updateEvent: updateEventAction,
  deleteEvent: deleteEventAction,
  restoreEvent: restoreEventAction,
  createMeasurement: createMeasurementAction,
  updateMeasurement: updateMeasurementAction,
  deleteMeasurement: deleteMeasurementAction,
  restoreMeasurement: restoreMeasurementAction,
};

/**
 * Wires the IndexedDB outbox into `submit()` and replays queued writes when the
 * connection is back (online event, tab becomes visible, or on mount).
 */
export function OutboxProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const router = useRouter();
  const replaying = useRef(false);

  useEffect(() => {
    registerOutbox(enqueueOutbox);

    const replay = async () => {
      if (replaying.current || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
      if ((await outboxCount()) === 0) return;
      replaying.current = true;
      try {
        const done = await replayOutbox(async (name, payload) => {
          try {
            const res = await ACTIONS[name](payload);
            return { ok: res.ok, retry: false };
          } catch {
            return { ok: false, retry: true };
          }
        });
        if (done > 0) {
          toast.show(de.pwa.synced(done));
          router.refresh();
        }
      } finally {
        replaying.current = false;
      }
    };

    void replay();
    const onVisible = () => {
      if (document.visibilityState === "visible") void replay();
    };
    window.addEventListener("online", replay);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      registerOutbox(null);
      window.removeEventListener("online", replay);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, toast]);

  return <>{children}</>;
}
