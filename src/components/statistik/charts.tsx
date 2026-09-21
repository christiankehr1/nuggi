"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { de } from "@/i18n/de";

/**
 * Dumb chart components: they receive pre-aggregated, plain data from the
 * server page. Colours follow the design tokens (lavender = night, sun = nap,
 * mint = feeds, coral = bedtime).
 */

const AXIS = { fontSize: 11, fill: "var(--muted)" };
const GRID = "rgba(255,255,255,0.06)";
const TOOLTIP_STYLE = {
  contentStyle: { background: "#1b1e4b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 },
  labelStyle: { color: "var(--muted)" },
  itemStyle: { color: "var(--text)" },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

const h1 = (v: number) => `${(Math.round(v * 10) / 10).toString().replace(".", ",")} h`;
const hm = (minute: number) => {
  const m = Math.round(minute);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export interface SleepDayPoint {
  day: string;
  nap: number;
  night: number;
  avg: number | null;
}

export function SleepPerDayChart({ data }: { data: SleepDayPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} unit="h" />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v) => h1(Number(v))} />
        <Bar dataKey="night" stackId="s" name={de.stats.nightShare} fill="var(--lavender)" radius={[0, 0, 6, 6]} />
        <Bar dataKey="nap" stackId="s" name={de.stats.napShare} fill="var(--sun)" radius={[6, 6, 0, 0]} />
        <Line dataKey="avg" name={de.stats.avg7} stroke="var(--mint)" strokeWidth={2} dot={false} strokeDasharray="4 4" type="monotone" connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export interface BedtimePoint {
  day: string;
  /** minutes after 16:00 (so bars grow from the bottom) */
  offset: number | null;
  minute: number | null;
}

export function BedtimeChart({ data }: { data: BedtimePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }} barCategoryGap="35%">
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          domain={[0, 360]}
          ticks={[0, 120, 240, 360]}
          tickFormatter={(v) => hm(16 * 60 + Number(v))}
        />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v) => hm(16 * 60 + Number(v))} />
        <Bar dataKey="offset" name={de.stats.bedtimePerDay} fill="var(--coral)" radius={[6, 6, 6, 6]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface CountPoint {
  day: string;
  value: number | null;
}

export function WakingsChart({ data }: { data: CountPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }} barCategoryGap="35%">
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v) => de.stats.times(Number(v))} />
        <Bar dataKey="value" name={de.stats.nightWakings} fill="var(--lavender)" radius={[6, 6, 6, 6]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface WakeWindowPoint {
  day: string;
  median: number | null;
  band: [number, number];
}

export function WakeWindowChart({ data }: { data: WakeWindowPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} unit="′" />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v) => (Array.isArray(v) ? `${v[0]}–${v[1]} Min` : `${Math.round(Number(v))} Min`)} />
        <Area dataKey="band" name={de.stats.ageBand} stroke="none" fill="var(--lavender)" fillOpacity={0.15} type="monotone" />
        <Line dataKey="median" name={de.stats.median} stroke="var(--sun)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--sun)", strokeWidth: 0 }} type="monotone" connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export interface FeedPoint {
  day: string;
  feeds: number | null;
  ml: number | null;
}

export function FeedsChart({ data }: { data: FeedPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={data} margin={{ top: 8, right: 0, left: -22, bottom: 0 }} barCategoryGap="35%">
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis yAxisId="count" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis yAxisId="ml" orientation="right" tick={AXIS} axisLine={false} tickLine={false} width={44} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Bar yAxisId="count" dataKey="feeds" name={de.stats.feedsPerDay} fill="var(--mint)" radius={[6, 6, 6, 6]} />
        <Line yAxisId="ml" dataKey="ml" name={de.stats.mlPerDay} stroke="var(--sun)" strokeWidth={2} dot={{ r: 3, fill: "var(--sun)", strokeWidth: 0 }} type="monotone" connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export interface GrowthPoint {
  /** days since birth */
  age: number;
  value: number;
  label: string;
}

export function GrowthChart({ data, unit, color, reference }: { data: GrowthPoint[]; unit: string; color: string; reference?: number }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="age"
          type="number"
          domain={["dataMin", "dataMax"]}
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          tickFormatter={(d) => `${Math.round(Number(d) / 7)} Wo`}
        />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={["auto", "auto"]} unit={unit === "g" ? "" : ""} />
        <Tooltip
          {...TOOLTIP_STYLE}
          labelFormatter={(_, payload) => (payload?.[0]?.payload as GrowthPoint | undefined)?.label ?? ""}
          formatter={(v) => `${v} ${unit}`}
        />
        {reference !== undefined ? <ReferenceLine y={reference} stroke="var(--coral)" strokeDasharray="4 4" /> : null}
        <Line dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color, strokeWidth: 0 }} type="monotone" />
      </LineChart>
    </ResponsiveContainer>
  );
}
