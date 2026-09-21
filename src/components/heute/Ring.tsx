"use client";

import { formatInTimeZone } from "date-fns-tz";
import { useState } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";
import { WhySheet } from "@/components/heute/WhySheet";
import { useNow } from "@/hooks/useNow";
import { de } from "@/i18n/de";
import { durationLabel } from "@/lib/format";
import type { BabyEvent } from "@/lib/types";

/** Prediction serialised for the client (ISO strings instead of Dates). */
export interface PredictionView {
  state: "awake" | "asleep";
  nextNapStart: string;
  nextNapWindow: [string, string];
  predictedWakeTime?: string;
  nextIsBedtime: boolean;
  bedtime: string;
  confidence: "niedrig" | "mittel" | "hoch";
  reasoning: string[];
  todayWakeUp: string | null;
  currentSleepStart: string | null;
  currentSleepSubtype: "nap" | "night" | null;
}

interface RingProps {
  sleeps: BabyEvent[];
  prediction: PredictionView;
  tz: string;
  todayKey: string;
}

const SIZE = 320;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 132;
const STROKE = 16;

function minuteOfDay(iso: string, tz: string): number {
  return Number(formatInTimeZone(new Date(iso), tz, "H")) * 60 + Number(formatInTimeZone(new Date(iso), tz, "m"));
}
function dayKey(iso: string, tz: string): string {
  return formatInTimeZone(new Date(iso), tz, "yyyy-MM-dd");
}
function angle(minute: number): number {
  return (minute / 1440) * 360;
}
function polar(deg: number, r = R): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}
function arcPath(fromMin: number, toMin: number, r = R): string {
  const a0 = angle(fromMin);
  const a1 = angle(Math.max(toMin, fromMin + 2));
  const [x0, y0] = polar(a0, r);
  const [x1, y1] = polar(a1, r);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
function arcLength(fromMin: number, toMin: number, r = R): number {
  return ((Math.max(toMin - fromMin, 2) / 1440) * 2 * Math.PI * r);
}

/** Split an event into [from, to] minute segments on `todayKey`. */
function segmentsForToday(e: BabyEvent, tz: string, todayKey: string, now: Date): [number, number][] {
  const endIso = e.endedAt ?? now.toISOString();
  const startKey = dayKey(e.startedAt, tz);
  const endKey = dayKey(endIso, tz);
  const startMin = minuteOfDay(e.startedAt, tz);
  const endMin = minuteOfDay(endIso, tz);
  if (startKey === todayKey && endKey === todayKey) return [[startMin, endMin]];
  if (startKey < todayKey && endKey === todayKey) return [[0, endMin]];
  if (startKey === todayKey && endKey > todayKey) return [[startMin, 1440]];
  if (startKey < todayKey && endKey > todayKey) return [[0, 1440]];
  return [];
}

export function Ring({ sleeps, prediction, tz, todayKey }: RingProps) {
  const now = useNow(30_000);
  const [why, setWhy] = useState(false);
  const nowMin = minuteOfDay(now.toISOString(), tz);

  // --- centre copy ---------------------------------------------------------
  const mins = (iso: string) => Math.round((new Date(iso).getTime() - now.getTime()) / 60000);
  let headline: string;
  let sub: string | null = null;
  if (prediction.state === "asleep" && prediction.currentSleepStart) {
    headline = de.today.sleepingSince(durationLabel(-mins(prediction.currentSleepStart)));
    if (prediction.predictedWakeTime) sub = de.today.wakeExpected(formatInTimeZone(new Date(prediction.predictedWakeTime), tz, "HH:mm"));
  } else if (prediction.nextIsBedtime) {
    const m = mins(prediction.bedtime);
    headline = m <= 0 ? de.today.bedtimeNow : de.today.bedtimeIn(durationLabel(m));
    sub = de.today.bedtimeAt(formatInTimeZone(new Date(prediction.bedtime), tz, "HH:mm"));
  } else {
    const m = mins(prediction.nextNapStart);
    headline = m <= 0 ? de.today.nextNapNow : de.today.nextNapIn(durationLabel(m));
    sub = de.today.window(
      formatInTimeZone(new Date(prediction.nextNapWindow[0]), tz, "HH:mm"),
      formatInTimeZone(new Date(prediction.nextNapWindow[1]), tz, "HH:mm"),
    );
  }
  const confLabel =
    prediction.confidence === "hoch"
      ? de.today.confidenceHigh
      : prediction.confidence === "mittel"
        ? de.today.confidenceMid
        : de.today.confidenceLow;

  // --- arcs ----------------------------------------------------------------
  const sleepArcs = sleeps.flatMap((e) =>
    segmentsForToday(e, tz, todayKey, now).map(([from, to], i) => ({
      key: `${e.id}-${i}`,
      from,
      to,
      night: e.subtype === "night",
      running: e.endedAt === null,
    })),
  );
  const windowToday = dayKey(prediction.nextNapWindow[0], tz) === todayKey && !prediction.nextIsBedtime;
  const napWindow: [number, number] | null = windowToday
    ? [minuteOfDay(prediction.nextNapWindow[0], tz), minuteOfDay(prediction.nextNapWindow[1], tz)]
    : null;
  const wakeMarker = prediction.todayWakeUp && dayKey(prediction.todayWakeUp, tz) === todayKey ? minuteOfDay(prediction.todayWakeUp, tz) : null;
  const bedMarker = dayKey(prediction.bedtime, tz) === todayKey ? minuteOfDay(prediction.bedtime, tz) : null;
  const [nx, ny] = polar(angle(nowMin));

  return (
    <div className="relative mx-auto w-full max-w-[340px] animate-fade-up">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-auto w-full" role="img" aria-label={headline}>
        <defs>
          <radialGradient id="ring-glow" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="rgba(139,140,246,0)" />
            <stop offset="100%" stopColor="rgba(139,140,246,0.18)" />
          </radialGradient>
        </defs>
        <circle cx={CX} cy={CY} r={R + STROKE} fill="url(#ring-glow)" />
        {/* track */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE} />
        {/* hour ticks */}
        {[0, 6, 12, 18].map((h) => {
          const [tx, ty] = polar(angle(h * 60), R + STROKE / 2 + 12);
          return (
            <text key={h} x={tx} y={ty + 4} textAnchor="middle" fontSize="11" fill="var(--muted)" className="num">
              {h}
            </text>
          );
        })}
        {/* sleep arcs */}
        {sleepArcs.map((a) => (
          <path
            key={a.key}
            d={arcPath(a.from, a.to)}
            fill="none"
            stroke={a.night ? "var(--lavender)" : "var(--sun)"}
            strokeWidth={STROKE}
            strokeLinecap="round"
            className={`animate-arc ${a.running ? "animate-pulse-soft" : ""}`}
            style={{ ["--arc-length" as string]: arcLength(a.from, a.to), strokeDasharray: arcLength(a.from, a.to) }}
          />
        ))}
        {/* predicted nap window (dotted) */}
        {napWindow ? (
          <path
            d={arcPath(napWindow[0], napWindow[1])}
            fill="none"
            stroke="var(--lavender)"
            strokeWidth={STROKE - 6}
            strokeLinecap="round"
            strokeDasharray="3 7"
            opacity="0.9"
          />
        ) : null}
        {/* now marker */}
        <circle cx={nx} cy={ny} r={5} fill="var(--text)" stroke="var(--navy-900)" strokeWidth={2} />
        {/* wake-up + bedtime markers */}
        {wakeMarker !== null ? (
          <g transform={`translate(${polar(angle(wakeMarker), R + STROKE + 8).map((v) => v.toFixed(1)).join(" ")})`}>
            <circle r={12} fill="var(--navy-800)" stroke="var(--sun)" strokeWidth={1.5} />
            <g transform="translate(-8 -8)" color="var(--sun)">
              <SunIcon size={16} />
            </g>
          </g>
        ) : null}
        {bedMarker !== null ? (
          <g transform={`translate(${polar(angle(bedMarker), R + STROKE + 8).map((v) => v.toFixed(1)).join(" ")})`}>
            <circle r={12} fill="var(--navy-800)" stroke="var(--coral)" strokeWidth={1.5} />
            <g transform="translate(-8 -8)" color="var(--coral)">
              <MoonIcon size={16} />
            </g>
          </g>
        ) : null}
      </svg>

      {/* centre copy */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-14 text-center">
        <p className="text-balance text-xl font-bold leading-tight">{headline}</p>
        {sub ? <p className="num mt-1 text-lg text-lavender">{sub}</p> : null}
        <p className="mt-1 text-xs text-muted">{de.today.confidence(confLabel)}</p>
        <button
          type="button"
          onClick={() => setWhy(true)}
          className="pointer-events-auto mt-2 min-h-10 rounded-full px-3 text-sm font-semibold text-lavender underline-offset-4 hover:underline"
        >
          {de.common.why}
        </button>
      </div>
      <WhySheet open={why} onClose={() => setWhy(false)} reasoning={prediction.reasoning} />
    </div>
  );
}
