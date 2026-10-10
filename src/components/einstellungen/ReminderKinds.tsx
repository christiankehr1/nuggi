"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateBabyAction } from "@/actions/babies";
import { useToast } from "@/components/ui/Toast";
import { Toggle } from "@/components/ui/Toggle";
import { de } from "@/i18n/de";
import type { Baby, BabySettings } from "@/lib/types";

/** Every whole minute the server accepts (validation.ts: 5–60), since feeds differ by a minute or two. */
const BREAST_CUE_OPTIONS = Array.from({ length: 56 }, (_, i) => i + 5);

type ReminderPatch = Pick<Partial<BabySettings>, "reminders" | "breastCueMinutes">;

/**
 * Which reminders a baby gets, plus the Stillen-Hinweis delay. These are
 * per-baby settings (the cron reads them for every family device), saved on
 * every change. Shown once per baby, with the name only when there are several.
 */
export function ReminderKinds({ babies }: { babies: Baby[] }) {
  return (
    <>
      {babies.map((b) => (
        <BabyReminders key={b.id} baby={b} showName={babies.length > 1} />
      ))}
    </>
  );
}

function BabyReminders({ baby, showName }: { baby: Baby; showName: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [reminders, setReminders] = useState(baby.settings.reminders);
  const [cue, setCue] = useState(baby.settings.breastCueMinutes);

  const save = (patch: ReminderPatch, revert: () => void) =>
    startTransition(async () => {
      const res = await updateBabyAction({ id: baby.id, settings: patch });
      if (res.ok) {
        router.refresh();
      } else {
        revert();
        toast.show(res.error, { tone: "error" });
      }
    });

  const toggle = (kind: keyof BabySettings["reminders"], value: boolean) => {
    const prev = reminders;
    const next = { ...reminders, [kind]: value };
    setReminders(next);
    save({ reminders: next }, () => setReminders(prev));
  };

  const changeCue = (minutes: number) => {
    const prev = cue;
    setCue(minutes);
    save({ breastCueMinutes: minutes }, () => setCue(prev));
  };

  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white/5 px-4 py-2">
      {showName ? <span className="pt-1 text-sm font-medium text-muted">{baby.name}</span> : null}
      <Toggle label={de.settings.reminderNap} checked={reminders.nap} onChange={(v) => toggle("nap", v)} />
      <Toggle label={de.settings.reminderFeed} checked={reminders.feed} onChange={(v) => toggle("feed", v)} />
      <Toggle label={de.settings.reminderBedtime} checked={reminders.bedtime} onChange={(v) => toggle("bedtime", v)} />
      <Toggle label={de.settings.reminderBreast} checked={reminders.breast} onChange={(v) => toggle("breast", v)} />
      {reminders.breast ? (
        <label className="flex min-h-12 items-center justify-between gap-3">
          <span>{de.settings.breastCue}</span>
          <select className="input w-auto" value={cue} onChange={(e) => changeCue(Number(e.target.value))}>
            {BREAST_CUE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} {de.settings.minutes}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <p className="pb-1 text-xs text-muted">{de.settings.breastCueHint}</p>
    </div>
  );
}
