"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { logFeedAction, startBreastFeedAction, startSleepAction } from "@/actions/events";
import { BottleIcon, BowlIcon, BreastIcon, MoonIcon, ScaleIcon } from "@/components/icons";
import { MeasurementSheet } from "@/components/heute/MeasurementSheet";
import { BackdatePicker } from "@/components/ui/BackdatePicker";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { Stepper } from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/Toast";
import { de } from "@/i18n/de";
import { submit, type SubmitResult } from "@/lib/client-submit";
import { isInLocalWindow } from "@/lib/time";
import type { BabySettings, Side, SleepSubtype } from "@/lib/types";

type SheetKind = "sleep" | "breast" | "bottle" | "solids" | "measurement" | null;

interface QuickActionsProps {
  babyId: string;
  tz: string;
  settings: BabySettings;
  sleepRunning: boolean;
  feedRunning: boolean;
}

const LAST_ML_KEY = "nuggi:lastBottleMl";

function readLastMl(): number {
  try {
    const v = Number(localStorage.getItem(LAST_ML_KEY));
    return Number.isFinite(v) && v > 0 ? v : 120;
  } catch {
    return 120;
  }
}

const DEEP_LINKS: Record<string, SheetKind> = { schlaf: "sleep", stillen: "breast", flaeschchen: "bottle", beikost: "solids", messung: "measurement" };

export function QuickActions({ babyId, tz, settings, sleepRunning, feedRunning }: QuickActionsProps) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [pending, startTransition] = useTransition();
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const [sleepType, setSleepType] = useState<SleepSubtype>("nap");
  const [side, setSide] = useState<Side>("L");
  const [ml, setMl] = useState(120);
  const [solidsNote, setSolidsNote] = useState("");

  const openSheet = useCallback(
    (kind: SheetKind) => {
      const now = new Date();
      setStartedAt(now.toISOString());
      if (kind === "sleep") setSleepType(isInLocalWindow(now, settings.nightStart, settings.nightEnd, tz) ? "night" : "nap");
      if (kind === "bottle") setMl(readLastMl());
      setSheet(kind);
    },
    [settings.nightEnd, settings.nightStart, tz],
  );
  const close = useCallback(() => setSheet(null), []);

  // /heute?aktion=schlaf|stillen|flaeschchen|beikost|messung opens the sheet directly (manifest shortcuts)
  useEffect(() => {
    const wanted = DEEP_LINKS[searchParams.get("aktion") ?? ""];
    if (!wanted) return;
    const blocked = (wanted === "sleep" && sleepRunning) || (wanted === "breast" && feedRunning);
    // open on the next tick (like a tap) and drop the param so a reload doesn't re-open it
    const id = setTimeout(() => {
      if (!blocked) openSheet(wanted);
      router.replace(pathname);
    }, 0);
    return () => clearTimeout(id);
  }, [searchParams, openSheet, router, pathname, sleepRunning, feedRunning]);

  useEffect(() => {
    if (sheet === "bottle") {
      try {
        localStorage.setItem(LAST_ML_KEY, String(ml));
      } catch {
        /* ignore */
      }
    }
  }, [ml, sheet]);

  const handle = <T,>(res: SubmitResult<T>, successMessage?: string) => {
    if (res.ok) {
      if (successMessage) toast.show(successMessage);
      close();
    } else if (res.code === "offline") {
      toast.show(res.error);
      close();
    } else {
      toast.show(res.error, { tone: "error" });
    }
  };

  const startSleep = () =>
    startTransition(async () => {
      handle(await submit("startSleep", startSleepAction, { babyId, subtype: sleepType, startedAt }));
    });

  const startBreast = () =>
    startTransition(async () => {
      handle(await submit("startBreastFeed", startBreastFeedAction, { babyId, side, startedAt }));
    });

  const logBottle = () =>
    startTransition(async () => {
      handle(
        await submit("logFeed", logFeedAction, { babyId, subtype: "bottle", startedAt, amountMl: ml }),
        de.common.saved,
      );
    });

  const logSolids = () =>
    startTransition(async () => {
      handle(
        await submit("logFeed", logFeedAction, {
          babyId,
          subtype: "solids",
          startedAt,
          note: solidsNote || null,
        }),
        de.common.saved,
      );
      setSolidsNote("");
    });

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => openSheet("sleep")}
          disabled={sleepRunning}
          className="btn btn-primary col-span-2 h-16 text-lg"
        >
          <MoonIcon size={24} />
          {de.actions.startSleep}
        </button>
        <button
          type="button"
          onClick={() => openSheet("breast")}
          disabled={feedRunning}
          className="btn btn-mint h-14"
        >
          <BreastIcon size={22} />
          {de.actions.breast}
        </button>
        <button type="button" onClick={() => openSheet("bottle")} className="btn btn-mint h-14">
          <BottleIcon size={22} />
          {de.actions.bottle}
        </button>
        <button type="button" onClick={() => openSheet("solids")} className="btn btn-secondary h-14">
          <BowlIcon size={22} />
          {de.actions.solids}
        </button>
        <button type="button" onClick={() => openSheet("measurement")} className="btn btn-secondary h-14">
          <ScaleIcon size={22} />
          {de.actions.measurement}
        </button>
      </div>

      {/* Sleep */}
      <Sheet open={sheet === "sleep"} onClose={close} title={de.actions.startSleep}>
        <div className="flex flex-col gap-4">
          <Segmented
            value={sleepType}
            onChange={setSleepType}
            options={[
              { value: "nap", label: de.actions.sleepNap },
              { value: "night", label: de.actions.sleepNight },
            ]}
            label={de.actions.sleepTypeQuestion}
          />
          <BackdatePicker value={startedAt} onChange={setStartedAt} tz={tz} label={de.actions.startedAt} />
          <button type="button" className="btn btn-primary w-full text-lg" onClick={startSleep} disabled={pending}>
            <MoonIcon size={22} />
            {de.actions.startSleep}
          </button>
        </div>
      </Sheet>

      {/* Breast */}
      <Sheet open={sheet === "breast"} onClose={close} title={de.actions.breast}>
        <div className="flex flex-col gap-4">
          <Segmented
            value={side}
            onChange={setSide}
            tone="mint"
            options={[
              { value: "L", label: de.actions.breastLeft },
              { value: "R", label: de.actions.breastRight },
              { value: "both", label: de.actions.breastBoth },
            ]}
            label={de.events.side}
          />
          <BackdatePicker value={startedAt} onChange={setStartedAt} tz={tz} label={de.actions.startedAt} />
          <button type="button" className="btn btn-mint w-full text-lg" onClick={startBreast} disabled={pending}>
            <BreastIcon size={22} />
            {de.actions.startFeed}
          </button>
        </div>
      </Sheet>

      {/* Bottle */}
      <Sheet open={sheet === "bottle"} onClose={close} title={de.actions.bottle}>
        <div className="flex flex-col gap-4">
          <Stepper value={ml} onChange={setMl} presets={[60, 90, 120, 150, 180, 210, 240]} />
          <BackdatePicker value={startedAt} onChange={setStartedAt} tz={tz} label={de.actions.startedAt} />
          <button type="button" className="btn btn-mint w-full text-lg" onClick={logBottle} disabled={pending}>
            <BottleIcon size={22} />
            {de.actions.log}
          </button>
        </div>
      </Sheet>

      {/* Solids */}
      <Sheet open={sheet === "solids"} onClose={close} title={de.actions.solids}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted">{de.actions.whatWasEaten}</span>
            <input
              className="input"
              value={solidsNote}
              onChange={(e) => setSolidsNote(e.target.value)}
              placeholder={de.actions.solidsPlaceholder}
              maxLength={200}
            />
          </label>
          <BackdatePicker value={startedAt} onChange={setStartedAt} tz={tz} label={de.actions.startedAt} />
          <button type="button" className="btn btn-secondary w-full text-lg" onClick={logSolids} disabled={pending}>
            <BowlIcon size={22} />
            {de.actions.log}
          </button>
        </div>
      </Sheet>

      <MeasurementSheet open={sheet === "measurement"} onClose={close} babyId={babyId} tz={tz} />
    </>
  );
}
