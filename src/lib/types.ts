/**
 * Domain types shared by server, client and pure logic modules.
 * Timestamps are ISO-8601 strings in UTC so objects can cross the
 * server/client boundary unchanged. Pure modules parse them as needed.
 */

export type EventKind = "sleep" | "feed";
export type SleepSubtype = "nap" | "night";
export type FeedSubtype = "breast" | "bottle" | "solids";
export type EventSubtype = SleepSubtype | FeedSubtype;
export type Side = "L" | "R" | "both";
export type MeasurementKind = "weight_g" | "height_cm" | "head_cm" | "temp_c";
export type Sex = "f" | "m";

export interface ReminderToggles {
  nap: boolean;
  feed: boolean;
  bedtime: boolean;
  /** "Stillen läuft seit X Min" once a running breast feed reaches breastCueMinutes */
  breast: boolean;
}

export interface BabySettings {
  napLeadMinutes: number;
  /** null = age default */
  feedIntervalMinutes: number | null;
  /** minutes into a breast feed after which the cue is sent (see reminders.breast) */
  breastCueMinutes: number;
  /** "HH:mm" local time */
  bedtimeTarget: string;
  nightStart: string;
  nightEnd: string;
  reminders: ReminderToggles;
}

export const DEFAULT_BABY_SETTINGS: BabySettings = {
  napLeadMinutes: 15,
  feedIntervalMinutes: null,
  breastCueMinutes: 15,
  bedtimeTarget: "19:00",
  nightStart: "19:00",
  nightEnd: "07:00",
  reminders: { nap: true, feed: true, bedtime: true, breast: true },
};

export interface Family {
  id: string;
  name: string;
  timezone: string;
  createdAt: string;
}

export interface Member {
  id: string;
  familyId: string;
  name: string;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface Baby {
  id: string;
  familyId: string;
  name: string;
  /** YYYY-MM-DD */
  birthDate: string;
  sex: Sex | null;
  settings: BabySettings;
  createdAt: string;
}

export interface BabyEvent {
  id: string;
  familyId: string;
  babyId: string;
  memberId: string | null;
  kind: EventKind;
  subtype: EventSubtype;
  startedAt: string;
  endedAt: string | null;
  amountMl: number | null;
  side: Side | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  /** joined for display */
  memberName?: string | null;
}

export interface Measurement {
  id: string;
  familyId: string;
  babyId: string;
  memberId: string | null;
  kind: MeasurementKind;
  value: number;
  measuredAt: string;
  note: string | null;
  createdAt: string;
  memberName?: string | null;
}

export interface PushSubscriptionRow {
  id: string;
  familyId: string;
  memberId: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  createdAt: string;
  lastSuccessAt: string | null;
  failures: number;
}

export type ReminderKind = "nap" | "feed" | "bedtime" | "breast";
