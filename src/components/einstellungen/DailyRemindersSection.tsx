"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveDailyRemindersAction } from "@/actions/settings";
import { Toggle } from "@/components/ui/Toggle";
import { ClockIcon, PlusIcon } from "@/components/icons";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { de } from "@/i18n/de";
import { MAX_DAILY_REMINDERS, type DailyReminder } from "@/lib/types";

/**
 * Family-wide daily reminders ("Vitamine um 08:00"). The whole list is saved
 * in one go, so add/edit/delete all go through the same server action.
 */
export function DailyRemindersSection({ reminders }: { reminders: DailyReminder[] }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<DailyReminder | null | "new">(null);

  const persist = (next: DailyReminder[], onDone?: () => void) =>
    startTransition(async () => {
      const res = await saveDailyRemindersAction({ reminders: next });
      if (res.ok) {
        toast.show(de.common.saved);
        onDone?.();
        router.refresh();
      } else toast.show(res.error, { tone: "error" });
    });

  const toggle = (r: DailyReminder, enabled: boolean) =>
    persist(reminders.map((x) => (x.id === r.id ? { ...x, enabled } : x)));

  return (
    <section className="card flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-medium text-muted">
        <ClockIcon size={18} />
        {de.settings.dailyReminders}
      </h2>
      {reminders.length === 0 ? (
        <p className="text-sm text-muted">{de.settings.dailyRemindersEmpty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-white/10">
          {reminders.map((r) => (
            <li key={r.id} className="flex min-h-14 items-center gap-3 py-1">
              <button type="button" className="flex min-w-0 flex-1 flex-col items-start py-2 text-left" onClick={() => setEditing(r)}>
                <span className={`truncate font-medium ${r.enabled ? "" : "text-muted"}`}>{r.name}</span>
                <span className="text-xs text-muted">
                  {r.enabled ? de.settings.dailyReminderDaily(r.time) : de.settings.dailyReminderOff}
                  {" · "}
                  {[r.push ? "Push" : null, r.inApp ? "App" : null].filter(Boolean).join(" + ")}
                </span>
              </button>
              <Toggle label="" checked={r.enabled} onChange={(v) => toggle(r, v)} />
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="btn btn-secondary w-full"
        onClick={() => setEditing("new")}
        disabled={pending || reminders.length >= MAX_DAILY_REMINDERS}
      >
        <PlusIcon size={20} />
        {de.settings.addDailyReminder}
      </button>
      <p className="text-xs text-muted">{de.settings.dailyRemindersHint}</p>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? de.settings.addDailyReminder : de.settings.editDailyReminder}
      >
        <DailyReminderForm
          existing={editing === "new" ? null : editing}
          pending={pending}
          onSave={(r) => {
            const next = reminders.some((x) => x.id === r.id)
              ? reminders.map((x) => (x.id === r.id ? r : x))
              : [...reminders, r];
            persist(next, () => setEditing(null));
          }}
          onDelete={(id) => persist(reminders.filter((x) => x.id !== id), () => setEditing(null))}
        />
      </Sheet>
    </section>
  );
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `r-${Date.now()}`;
}

function DailyReminderForm({
  existing,
  pending,
  onSave,
  onDelete,
}: {
  existing: DailyReminder | null;
  pending: boolean;
  onSave: (r: DailyReminder) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [time, setTime] = useState(existing?.time ?? "08:00");
  const [push, setPush] = useState(existing?.push ?? true);
  const [inApp, setInApp] = useState(existing?.inApp ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const valid = name.trim().length > 0 && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) && (push || inApp);

  return (
    <div className="flex flex-col gap-4 pb-1">
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">{de.settings.dailyReminderName}</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={de.settings.dailyReminderNamePlaceholder}
          maxLength={40}
          autoComplete="off"
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">{de.settings.dailyReminderTime}</span>
        <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <div className="flex flex-col gap-1 rounded-2xl bg-white/5 px-4 py-2">
        <Toggle label={de.settings.dailyReminderPush} checked={push} onChange={setPush} />
        <Toggle label={de.settings.dailyReminderInApp} checked={inApp} onChange={setInApp} />
        <p className="pb-1 text-xs text-muted">
          {!push && !inApp ? de.settings.dailyReminderChannelRequired : de.settings.dailyReminderPushHint}
        </p>
      </div>
      <div className="flex gap-3">
        {existing ? (
          confirmDelete ? (
            <button type="button" className="btn bg-danger px-4 text-navy-900" onClick={() => onDelete(existing.id)} disabled={pending}>
              {de.common.delete}
            </button>
          ) : (
            <button type="button" className="btn btn-secondary px-4 text-danger" onClick={() => setConfirmDelete(true)}>
              {de.settings.deleteDailyReminder}
            </button>
          )
        ) : null}
        <button
          type="button"
          className="btn btn-primary flex-1 text-lg"
          disabled={!valid || pending}
          onClick={() =>
            onSave({
              id: existing?.id ?? newId(),
              name: name.trim(),
              time,
              enabled: existing?.enabled ?? true,
              push,
              inApp,
            })
          }
        >
          {de.common.save}
        </button>
      </div>
    </div>
  );
}
