import { EventRow } from "@/components/verlauf/EventRow";
import { MeasurementRow } from "@/components/verlauf/MeasurementRow";
import { de } from "@/i18n/de";
import type { DayGroup } from "@/lib/events-utils";
import { dayHeading, durationLabel } from "@/lib/format";

interface DayListProps {
  groups: DayGroup[];
  tz: string;
  todayKey: string;
  yesterdayKey: string;
  now: string;
}

export function DayList({ groups, tz, todayKey, yesterdayKey, now }: DayListProps) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.dayKey} className="card p-3 animate-fade-up">
          <header className="flex items-baseline justify-between px-2 pb-2 pt-1">
            <h2 className="text-base font-semibold">{dayHeading(g.dayKey, todayKey, yesterdayKey)}</h2>
            <p className="text-xs text-muted">
              <span className="text-lavender">{de.history.totalSleep}</span> {durationLabel(g.totals.sleepMinutes)}
              <span className="mx-1.5 opacity-60">·</span>
              <span className="text-mint">{de.history.meals}</span> {g.totals.feeds}
              {g.totals.ml > 0 ? (
                <>
                  <span className="mx-1.5 opacity-60">·</span>
                  {g.totals.ml} {de.history.ml}
                </>
              ) : null}
            </p>
          </header>
          <ul className="flex flex-col">
            {g.measurements.map((m) => (
              <li key={m.id}>
                <MeasurementRow measurement={m} tz={tz} />
              </li>
            ))}
            {g.events.map((e) => (
              <li key={e.id}>
                <EventRow event={e} tz={tz} now={now} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
