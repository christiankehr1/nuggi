"use client";

import { useState, useTransition } from "react";
import { deleteMeasurementAction, restoreMeasurementAction } from "@/actions/measurements";
import { HeadIcon, RulerIcon, ScaleIcon, ThermometerIcon, TrashIcon } from "@/components/icons";
import { MeasurementSheet } from "@/components/heute/MeasurementSheet";
import { useToast } from "@/components/ui/Toast";
import { de } from "@/i18n/de";
import { submit } from "@/lib/client-submit";
import { isFever, measurementKindLabel, measurementValueLabel } from "@/lib/format";
import { fmtTime } from "@/lib/time";
import type { Measurement } from "@/lib/types";

function iconFor(m: Measurement) {
  switch (m.kind) {
    case "weight_g":
      return <ScaleIcon size={22} className="text-sun" />;
    case "height_cm":
      return <RulerIcon size={22} className="text-sun" />;
    case "head_cm":
      return <HeadIcon size={22} className="text-sun" />;
    case "temp_c":
      return <ThermometerIcon size={22} className={isFever(m) ? "text-coral" : "text-sun"} />;
  }
}

export function MeasurementRow({ measurement, tz }: { measurement: Measurement; tz: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const fever = isFever(measurement);

  const remove = () =>
    startTransition(async () => {
      const res = await submit("deleteMeasurement", deleteMeasurementAction, { id: measurement.id });
      if (res.ok) {
        const deleted = res.data;
        toast.show(de.events.deletedToast, {
          actionLabel: de.common.undo,
          onAction: async () => {
            const r = await submit("restoreMeasurement", restoreMeasurementAction, deleted);
            if (!r.ok && r.code !== "offline") toast.show(r.error, { tone: "error" });
          },
        });
      } else {
        toast.show(res.error, { tone: res.code === "offline" ? "default" : "error" });
      }
    });

  return (
    <>
      <div
        className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 ${
          fever ? "bg-coral-soft" : ""
        }`}
      >
        <button type="button" onClick={() => setOpen(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/6">
            {iconFor(measurement)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">
              {measurementKindLabel(measurement.kind)} · {measurementValueLabel(measurement)}
              {fever ? (
                <span className="ml-2 rounded-full bg-coral px-2 py-0.5 text-xs font-semibold text-navy-900">
                  {de.history.fever}
                </span>
              ) : null}
            </span>
            <span className="text-sm text-muted">
              {fmtTime(measurement.measuredAt, tz)}
              {measurement.note ? ` · ${measurement.note}` : ""}
              {measurement.memberName ? ` · ${de.events.loggedBy(measurement.memberName)}` : ""}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          aria-label={de.common.delete}
          className="btn btn-ghost h-11 min-h-11 w-11 px-0 text-muted"
        >
          <TrashIcon size={20} />
        </button>
      </div>
      <MeasurementSheet open={open} onClose={() => setOpen(false)} babyId={measurement.babyId} tz={tz} existing={measurement} />
    </>
  );
}
