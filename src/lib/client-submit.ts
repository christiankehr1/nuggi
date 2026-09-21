"use client";

import { de } from "@/i18n/de";
import type { ActionResult } from "@/lib/action-result";

export type OutboxActionName =
  | "startSleep"
  | "startBreastFeed"
  | "endRunning"
  | "logFeed"
  | "createEvent"
  | "updateEvent"
  | "deleteEvent"
  | "restoreEvent"
  | "createMeasurement"
  | "updateMeasurement"
  | "deleteMeasurement"
  | "restoreMeasurement";

export type SubmitResult<T> = ActionResult<T> | { ok: false; error: string; code: "offline" };

type Enqueue = (name: OutboxActionName, payload: unknown) => Promise<void>;
let enqueue: Enqueue | null = null;

/** Registered by the offline outbox provider (Phase 5). */
export function registerOutbox(fn: Enqueue | null): void {
  enqueue = fn;
}

function looksLikeNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /fetch|network|Failed to|Load failed|NetworkError/i.test(msg);
}

/**
 * Call a server action with a JSON payload. When the network is down the
 * payload is queued in the outbox (if registered) and an "offline" result is
 * returned so the UI can confirm optimistically.
 */
export async function submit<T>(
  name: OutboxActionName,
  action: (input: unknown) => Promise<ActionResult<T>>,
  payload: unknown,
): Promise<SubmitResult<T>> {
  try {
    return await action(payload);
  } catch (err) {
    if (looksLikeNetworkError(err) && enqueue) {
      await enqueue(name, payload);
      return { ok: false, error: de.common.offlineSaved, code: "offline" };
    }
    return { ok: false, error: de.common.error, code: "unknown" };
  }
}
