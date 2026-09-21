import Link from "next/link";
import { BabySwitcher } from "@/components/heute/BabySwitcher";
import { QuickActions } from "@/components/heute/QuickActions";
import { RunningTimer } from "@/components/heute/RunningTimer";
import { StatusRow } from "@/components/heute/StatusRow";
import { de } from "@/i18n/de";
import { ageLabel } from "@/lib/age";
import { requireSession } from "@/lib/auth";
import { listEventsBetween } from "@/lib/db/events";
import { lastEnded, lastStarted, runningOf } from "@/lib/events-utils";
import { resolveBabyContext } from "@/lib/selected-baby";
import { addLocalDays, startOfLocalDay } from "@/lib/time";

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

  // last 2 days is enough for status + running timers (prediction uses 14 days in Phase 3)
  const from = addLocalDays(startOfLocalDay(now, tz), -2, tz);
  const events = await listEventsBetween(scope, baby.id, from, addLocalDays(now, 2, tz));
  const runningSleep = runningOf(events, "sleep");
  const runningFeed = runningOf(events, "feed");
  const lastSleep = lastEnded(events, "sleep");
  const lastFeed = lastStarted(events, "feed");
  const awakeSince = runningSleep ? null : (lastSleep?.endedAt ?? null);

  return (
    <div className="flex min-h-[calc(100dvh-var(--tabbar-height)-var(--safe-bottom)-2rem)] flex-col gap-4 animate-fade-up">
      <header className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">
            {baby.name} <span className="font-normal text-muted">· {ageLabel(baby.birthDate, now, tz)}</span>
          </h1>
        </div>
        <BabySwitcher babies={babies} selectedId={baby.id} />
      </header>

      <div className="flex flex-1 flex-col justify-center gap-4">
        {runningSleep ? <RunningTimer event={runningSleep} tz={tz} /> : null}
        {runningFeed ? <RunningTimer event={runningFeed} tz={tz} /> : null}
        {!runningSleep && !runningFeed && events.length === 0 ? (
          <div className="card p-6 text-center text-muted">{de.today.empty}</div>
        ) : null}
        <StatusRow awakeSince={awakeSince} lastFeed={lastFeed} />
      </div>

      <QuickActions
        babyId={baby.id}
        tz={tz}
        settings={baby.settings}
        sleepRunning={!!runningSleep}
        feedRunning={!!runningFeed}
      />
    </div>
  );
}
