# Real-device checklist (iPhone, iOS 16.4+)

Run through this once after the first deployment and after every larger change.
Tick what passes, note the iOS version and device.

Device: ______________  iOS: ______  Date: ______  Build: ______

## Install & shell

- [ ] Safari → Teilen → Zum Home-Bildschirm → Hinzufügen: icon shows the Nuggi artwork, name "Nuggi".
- [ ] Opening from the home screen shows no Safari chrome (standalone), status bar is translucent navy.
- [ ] Content respects the notch/Dynamic Island (header not hidden) and the home indicator (tab bar above it).
- [ ] Rotating to landscape and back does not break the layout.
- [ ] Inputs do not zoom the page when focused (font ≥ 16 px).
- [ ] Install banner appears in Safari (not installed) and not in the installed app; "Später" hides it for 7 days.

## Login

- [ ] Wrong code shows the German error; lowercase / missing dash still works.
- [ ] After login, killing the app and reopening lands on Heute without logging in again.
- [ ] Second phone with the same code and a different name: both names appear under "Wer trägt ein".
- [ ] Second family's code never shows the first family's baby (switch via Einstellungen → Familie wechseln).

## Heute

- [ ] Ring shows today's sleeps, the dotted predicted window, sun (wake-up) and moon (bedtime) markers.
- [ ] Centre line updates every 30 s; "Warum?" opens the reasoning sheet.
- [ ] Schlafen starten → running timer ticks every second; after nightStart "Nacht" is pre-selected.
- [ ] Beenden ends the timer with one tap, Verlauf shows the entry.
- [ ] Stillen L/R starts a running feed; Fläschchen remembers the last ml; Beikost with note; Messung saves.
- [ ] "Vorhin" chips and the datetime wheel backdate the start time correctly (check Verlauf times).
- [ ] Baby switcher chip appears with 2+ babies and switches all tabs.

## Verlauf

- [ ] Day headers show totals; a night sleep is split across two days.
- [ ] Tap row → edit sheet; change times/subtype/amount/side/note → saved.
- [ ] Delete → toast with Rückgängig restores the entry (with the original author).
- [ ] "+" adds a past event and a measurement; temperature ≥ 38.0 is highlighted as Fieber.
- [ ] "Frühere Tage laden" pages back.

## Statistik

- [ ] Week picker arrows and swipe change the week; future weeks are not reachable.
- [ ] Charts render and scroll smoothly; tooltips work on touch.
- [ ] Weekly summary sentences read naturally and match the charts.
- [ ] Growth charts show all-time measurements; fever line visible on temperature.
- [ ] CSV export downloads (Dateien app) and opens in Numbers with umlauts intact.

## Offline

- [ ] Airplane mode: opening the installed app still shows the last-loaded Heute/Verlauf.
- [ ] Airplane mode: log a bottle → toast "Offline gespeichert…"; leave airplane mode → toast "1 Eintrag nachgetragen…" and the entry appears.

## Push

- [ ] Einstellungen → Erinnerungen → "Erinnerungen aktivieren" prompts for permission (only from the installed app).
- [ ] "Test-Mitteilung senden" arrives within seconds, tapping it opens Nuggi on Heute.
- [ ] Nap reminder arrives ~napLeadMinutes before the predicted nap (check cron-job.org history: `due` > 0).
- [ ] Feed reminder is muted at night for a baby ≥ 12 weeks.
- [ ] Bedtime reminder arrives before the predicted bedtime.
- [ ] Turning a kind off in the baby settings stops that reminder; "Auf diesem Gerät deaktivieren" stops all on this phone.
- [ ] Second phone of the same family receives the same reminders.

## Housekeeping

- [ ] `/api/health` returns `{"ok":true}`; Vercel cron shows a daily success.
- [ ] `/admin` asks for basic auth; lists families with member and baby names only.
