"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { OutboxActionName } from "@/lib/client-submit";

/**
 * IndexedDB outbox for writes that failed because the network was down.
 * Entries are replayed in order when the app comes back online.
 */
interface OutboxDB extends DBSchema {
  outbox: {
    key: number;
    value: { id?: number; name: OutboxActionName; payload: unknown; createdAt: number; attempts: number };
    indexes: { createdAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<OutboxDB>> | null = null;

function db(): Promise<IDBPDatabase<OutboxDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OutboxDB>("nuggi-outbox", 1, {
      upgrade(database) {
        const store = database.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
        store.createIndex("createdAt", "createdAt");
      },
    });
  }
  return dbPromise;
}

export async function enqueueOutbox(name: OutboxActionName, payload: unknown): Promise<void> {
  const d = await db();
  await d.add("outbox", { name, payload, createdAt: Date.now(), attempts: 0 });
}

export async function outboxCount(): Promise<number> {
  try {
    const d = await db();
    return await d.count("outbox");
  } catch {
    return 0;
  }
}

export type Replayer = (name: OutboxActionName, payload: unknown) => Promise<{ ok: boolean; retry: boolean }>;

/**
 * Replay queued writes oldest-first. Stops at the first network failure so
 * order is preserved. Permanent failures (validation, conflict) are dropped.
 * Returns the number of successfully replayed entries.
 */
export async function replayOutbox(replayer: Replayer): Promise<number> {
  const d = await db();
  const entries = await d.getAllFromIndex("outbox", "createdAt");
  let done = 0;
  for (const entry of entries) {
    const result = await replayer(entry.name, entry.payload);
    if (result.ok) {
      await d.delete("outbox", entry.id!);
      done += 1;
    } else if (result.retry) {
      entry.attempts += 1;
      if (entry.attempts >= 20) await d.delete("outbox", entry.id!);
      else await d.put("outbox", entry);
      break;
    } else {
      await d.delete("outbox", entry.id!);
    }
  }
  return done;
}
