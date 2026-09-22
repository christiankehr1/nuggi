/**
 * App-wide constants. Renaming the app is a one-line change here.
 */
export const APP_NAME = "Nuggi";
export const APP_SHORT_NAME = "Nuggi";
export const APP_DESCRIPTION =
  "Schlaf, Mahlzeiten und Wachstum deines Babys – mit Nickerchen-Vorhersage.";

export const DEFAULT_TIMEZONE = "Europe/Zurich";

/** Session cookie */
export const SESSION_COOKIE = "nuggi_session";
export const SESSION_DAYS = 180;
/** Re-issue the cookie when less than this many days remain (sliding session). */
export const SESSION_RENEW_BEFORE_DAYS = 150;

/** Login rate limit */
export const LOGIN_MAX_ATTEMPTS = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** Family code format: XXX-XXXX, alphabet without 0 O 1 I L */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_PREFIX_LENGTH = 3;
export const CODE_SUFFIX_LENGTH = 4;

/** Reminder scheduler window (± minutes) – matches the 5-minute cron cadence. */
export const REMINDER_WINDOW_MINUTES = 5;
export const REMINDER_DEDUPE_ROUND_MINUTES = 10;
/** A breast feed still "running" this long after its cue is a forgotten timer: no cue any more. */
export const BREAST_CUE_GRACE_MINUTES = 60;
export const PUSH_MAX_FAILURES = 3;

/** Theme colours (kept in sync with globals.css tokens). */
export const THEME_COLOR = "#0B0D2B";
