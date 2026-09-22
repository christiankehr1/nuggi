"use client";

import { useState } from "react";
import { PlusIcon, ScaleIcon, ClockIcon } from "@/components/icons";
import { MeasurementSheet } from "@/components/heute/MeasurementSheet";
import { Sheet } from "@/components/ui/Sheet";
import { EditEventSheet } from "@/components/verlauf/EditEventSheet";
import { de } from "@/i18n/de";

/** Floating "+" for manual past events and measurements. */
export function AddMenu({ babyId, tz }: { babyId: string; tz: string }) {
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<"event" | "measurement" | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => setMenu(true)}
        aria-label={de.common.add}
        className="btn btn-primary fixed right-4 z-30 h-14 w-14 rounded-full px-0 shadow-lg"
        style={{ bottom: "calc(var(--tabbar-clearance) + 16px)" }}
      >
        <PlusIcon size={28} />
      </button>
      <Sheet open={menu} onClose={() => setMenu(false)} title={de.common.add}>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="btn btn-secondary h-20 flex-col gap-1"
            onClick={() => {
              setMenu(false);
              setSheet("event");
            }}
          >
            <ClockIcon size={24} className="text-lavender" />
            {de.history.addEvent}
          </button>
          <button
            type="button"
            className="btn btn-secondary h-20 flex-col gap-1"
            onClick={() => {
              setMenu(false);
              setSheet("measurement");
            }}
          >
            <ScaleIcon size={24} className="text-sun" />
            {de.history.addMeasurement}
          </button>
        </div>
      </Sheet>
      <EditEventSheet open={sheet === "event"} onClose={() => setSheet(null)} babyId={babyId} tz={tz} />
      <MeasurementSheet open={sheet === "measurement"} onClose={() => setSheet(null)} babyId={babyId} tz={tz} />
    </>
  );
}
