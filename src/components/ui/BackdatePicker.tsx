"use client";

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { useState } from "react";
import { de } from "@/i18n/de";

interface BackdatePickerProps {
  /** ISO string of the chosen instant */
  value: string;
  onChange: (iso: string) => void;
  tz: string;
  label?: string;
  /** max = now by default */
  allowFuture?: boolean;
}

const QUICK = [
  { label: de.common.now, minutes: 0 },
  { label: "−5 Min", minutes: 5 },
  { label: "−15 Min", minutes: 15 },
  { label: "−30 Min", minutes: 30 },
  { label: "−1 h", minutes: 60 },
  { label: "−2 h", minutes: 120 },
];

/**
 * "Vorhin" backdating: quick chips plus the native iOS time wheel via
 * <input type="datetime-local"> in the family's timezone.
 */
export function BackdatePicker({ value, onChange, tz, label, allowFuture = false }: BackdatePickerProps) {
  const [quick, setQuick] = useState<number | null>(0);
  const [maxLocal] = useState(() =>
    allowFuture ? undefined : formatInTimeZone(new Date(), tz, "yyyy-MM-dd'T'HH:mm"),
  );
  const localValue = formatInTimeZone(new Date(value), tz, "yyyy-MM-dd'T'HH:mm");

  return (
    <div className="flex flex-col gap-2">
      {label ? <span className="text-sm font-medium text-muted">{label}</span> : null}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {QUICK.map((q) => {
          const active = quick === q.minutes;
          return (
            <button
              key={q.minutes}
              type="button"
              onClick={() => {
                setQuick(q.minutes);
                onChange(new Date(Date.now() - q.minutes * 60000).toISOString());
              }}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${
                active ? "bg-lavender text-navy-900" : "bg-white/8 text-text"
              }`}
            >
              {q.label}
            </button>
          );
        })}
      </div>
      <input
        type="datetime-local"
        className="input"
        value={localValue}
        max={maxLocal}
        onChange={(e) => {
          if (!e.target.value) return;
          setQuick(null);
          onChange(fromZonedTime(e.target.value, tz).toISOString());
        }}
        aria-label={label ?? de.actions.startedAt}
      />
    </div>
  );
}
