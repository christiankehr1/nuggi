import Link from "next/link";
import { Suspense } from "react";
import { BabySwitcher } from "@/components/heute/BabySwitcher";
import { QuickActions } from "@/components/heute/QuickActions";
import { Ring, type PredictionView } from "@/components/heute/Ring";
import { RunningTimer } from "@/components/heute/RunningTimer";
import { StatusRow } from "@/components/heute/StatusRow";
import { de } from "@/i18n/de";
import { ageLabel } from "@/lib/age";
import { requireSession } from "@/lib/auth";
import { listEventsBetween } from "@/lib/db/events";
import { lastEnded, lastStarted, runningOf } from "@/lib/events-utils";
import { resolveBabyContext } from "@/lib/selected-baby";
import { predict } from "@/lib/sleep/predict";
import { addLocalDays, localDayKey, startOfLocalDay } from "@/lib/time";

export default async function HeutePage() {
  const scope = await requireSession();
  const { babies, baby, tz } = await resolveBabyContext(scope);
  const now = new Date();

  if (!baby) {
    return (
      <div className="flex min-h-[70dvh] flex-col justify-center gap-4 animate-fade-up">
        <div className="card p-6 text-center">
          <p className="text-lg font-semibold">{de.today.noBaby}</p>
          <p className="mt-1 text-sm text-muted">{de.today.noBabyHint}</p>
          <Link href="/einstellungen?baby=neu" className="btn btn-primary mt-5 w-full">
            {de.today.addBaby}
          </Link>
        </div>
      </div>
    );
  }

  const todayStart = startOfLocalDay(now, tz);
  const from = addLocalDays(todayStart, -14, tz);
  const events = await listEventsBetween(scope, baby.id, from, addLocalDays(now, 2, tz));
  const runningSleep = runningOf(events, "sleep");
  const runningFeed = runningOf(events, "feed");
  const lastSleep = lastEnded(events, "sleep");
  const lastFeed = lastStarted(events, "feed");
  const awakeSince = runningSleep ? null : (lastSleep?.endedAt ?? null);
  const todayKey = localDayKey(now, tz);

  const p = predict({ baby, events, now, tz });
  const prediction: PredictionView = {
    state: p.state,
    nextNapStart: p.nextNapStart.toISOString(),
    nextNapWindow: [p.nextNapWindow[0].toISOString(), p.nextNapWindow[1].toISOString()],
    predictedWakeTime: p.predictedWakeTime?.toISOString(),
    nextIsBedtime: p.nextIsBedtime,
    bedtime: p.bedtime.toISOString(),
    confidence: p.confidence,
    reasoning: p.reasoning,
    todayWakeUp: p.todayWakeUp?.toISOString() ?? null,
    currentSleepStart: p.currentSleep?.startedAt ?? null,
    currentSleepSubtype: p.currentSleep ? (p.currentSleep.subtype as "nap" | "night") : null,
  };
  const yesterdayStart = addLocalDays(todayStart, -1, tz);
  const todaySleeps = events.filter(
    (e) => e.kind === "sleep" && new Date(e.startedAt) >= yesterdayStart,
  );
  const todayFeeds = events.filter((e) => e.kind === "feed" && localDayKey(e.startedAt, tz) === todayKey);

  return (
    <div className="flex min-h-[calc(100dvh-var(--top-inset)-var(--content-bottom))] flex-col gap-4 animate-fade-up">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">
          {baby.name} <span className="font-normal text-muted">· {ageLabel(baby.birthDate, now, tz)}</span>
        </h1>
        <BabySwitcher babies={babies} selectedId={baby.id} />
      </header>

      <div className="flex flex-1 flex-col justify-center gap-4">
        <Ring sleeps={todaySleeps} feeds={todayFeeds} prediction={prediction} tz={tz} todayKey={todayKey} />
        {runningSleep ? <RunningTimer event={runningSleep} tz={tz} /> : null}
        {runningFeed ? (
          <RunningTimer event={runningFeed} tz={tz} cueMinutes={baby.settings.reminders.breast ? baby.settings.breastCueMinutes : null} />
        ) : null}
        {events.length === 0 ? <div className="card p-4 text-center text-sm text-muted">{de.today.empty}</div> : null}
        <StatusRow awakeSince={awakeSince} lastFeed={lastFeed} />
      </div>

      <Suspense>
        <QuickActions
          babyId={baby.id}
          tz={tz}
          settings={baby.settings}
          sleepRunning={!!runningSleep}
          feedRunning={!!runningFeed}
        />
      </Suspense>
    </div>
  );
}
