import Link from "next/link";
import { BabySwitcher } from "@/components/heute/BabySwitcher";
import { AddMenu } from "@/components/verlauf/AddMenu";
import { DayList } from "@/components/verlauf/DayList";
import { de } from "@/i18n/de";
import { requireSession } from "@/lib/auth";
import { listEventsPage } from "@/lib/db/events";
import { listMeasurements } from "@/lib/db/measurements";
import { groupByDay } from "@/lib/events-utils";
import { resolveBabyContext } from "@/lib/selected-baby";
import { addLocalDays, dayKeyToDate, localDayKey, startOfLocalDay } from "@/lib/time";

const PAGE_SIZE = 120;

export default async function VerlaufPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const scope = await requireSession();
  const { babies, baby, tz } = await resolveBabyContext(scope);
  const now = new Date();
  const params = await searchParams;

  if (!baby) {
    return (
      <div className="flex flex-col gap-4 animate-fade-up">
        <h1 className="text-2xl font-bold">{de.history.title}</h1>
        <div className="card p-6 text-center text-muted">
          <p className="font-medium text-text">{de.today.noBaby}</p>
          <p className="mt-1 text-sm">{de.today.noBabyHint}</p>
        </div>
      </div>
    );
  }

  const before = params.before && /^\d{4}-\d{2}-\d{2}$/.test(params.before)
    ? dayKeyToDate(params.before, tz)
    : addLocalDays(now, 1, tz);
  const events = await listEventsPage(scope, baby.id, before, PAGE_SIZE);
  const oldestStart = events.length ? events[events.length - 1]!.startedAt : null;
  const measurements = await listMeasurements(scope, baby.id, {
    from: oldestStart ? startOfLocalDay(oldestStart, tz) : addLocalDays(before, -30, tz),
    to: before,
  });
  const groups = groupByDay(events, measurements, tz, now);
  const todayKey = localDayKey(now, tz);
  const yesterdayKey = localDayKey(addLocalDays(now, -1, tz), tz);
  const hasMore = events.length >= PAGE_SIZE;
  const nextBefore = oldestStart ? localDayKey(oldestStart, tz) : null;

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">{de.history.title}</h1>
        <BabySwitcher babies={babies} selectedId={baby.id} />
      </header>
      {groups.length === 0 ? (
        <div className="card p-6 text-center text-muted">{de.history.empty}</div>
      ) : (
        <DayList groups={groups} tz={tz} todayKey={todayKey} yesterdayKey={yesterdayKey} now={now.toISOString()} />
      )}
      {hasMore && nextBefore ? (
        <Link href={`/verlauf?before=${nextBefore}`} className="btn btn-secondary w-full">
          {de.history.loadMore}
        </Link>
      ) : null}
      <div className="h-16" />
      <AddMenu babyId={baby.id} tz={tz} />
    </div>
  );
}
