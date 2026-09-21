"use client";

import { useState, useTransition } from "react";
import { createMeasurementAction, updateMeasurementAction } from "@/actions/measurements";
import { HeadIcon, RulerIcon, ScaleIcon, ThermometerIcon } from "@/components/icons";
import { BackdatePicker } from "@/components/ui/BackdatePicker";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { de } from "@/i18n/de";
import { submit } from "@/lib/client-submit";
import { measurementUnit } from "@/lib/format";
import type { Measurement, MeasurementKind } from "@/lib/types";
import { MEASUREMENT_RANGES } from "@/lib/validation";

interface MeasurementSheetProps {
  open: boolean;
  onClose: () => void;
  babyId: string;
  tz: string;
  /** when set, the sheet edits this measurement */
  existing?: Measurement | null;
}

const KIND_OPTIONS: { value: MeasurementKind; label: string; icon: React.ReactNode }[] = [
  { value: "weight_g", label: de.measurements.weight, icon: <ScaleIcon size={18} /> },
  { value: "height_cm", label: de.measurements.height, icon: <RulerIcon size={18} /> },
  { value: "head_cm", label: de.measurements.head, icon: <HeadIcon size={18} /> },
  { value: "temp_c", label: de.measurements.temp, icon: <ThermometerIcon size={18} /> },
];

const STEP: Record<MeasurementKind, number> = { weight_g: 10, height_cm: 0.5, head_cm: 0.1, temp_c: 0.1 };

export function MeasurementSheet({ open, onClose, babyId, tz, existing }: MeasurementSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={de.measurements.title}>
      <MeasurementForm onClose={onClose} babyId={babyId} tz={tz} existing={existing ?? null} />
    </Sheet>
  );
}

function MeasurementForm({
  onClose,
  babyId,
  tz,
  existing,
}: {
  onClose: () => void;
  babyId: string;
  tz: string;
  existing: Measurement | null;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<MeasurementKind>(existing?.kind ?? "weight_g");
  const [value, setValue] = useState<string>(existing ? String(existing.value) : "");
  const [measuredAt, setMeasuredAt] = useState<string>(() => existing?.measuredAt ?? new Date().toISOString());
  const [note, setNote] = useState(existing?.note ?? "");

  const [min, max] = MEASUREMENT_RANGES[kind];
  const numeric = Number(value.replace(",", "."));
  const valid = value !== "" && Number.isFinite(numeric) && numeric >= min && numeric <= max;

  const save = () =>
    startTransition(async () => {
      const payload = { kind, value: numeric, measuredAt, note: note || null };
      const res = existing
        ? await submit("updateMeasurement", updateMeasurementAction, { id: existing.id, ...payload })
        : await submit("createMeasurement", createMeasurementAction, { babyId, ...payload });
      if (res.ok) {
        toast.show(de.common.saved);
        onClose();
      } else if (res.code === "offline") {
        toast.show(res.error);
        onClose();
      } else {
        toast.show(res.error, { tone: "error" });
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <Segmented value={kind} onChange={setKind} options={KIND_OPTIONS} tone="sun" label={de.measurements.kindLabel} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">{de.measurements.valueLabel}</span>
        <div className="flex items-center gap-3">
          <input
            type="number"
            inputMode="decimal"
            step={STEP[kind]}
            min={min}
            max={max}
            className="input num flex-1 text-3xl font-bold"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={kind === "weight_g" ? "4200" : kind === "temp_c" ? "36.8" : "60.5"}
          />
          <span className="text-xl text-muted">{measurementUnit(kind)}</span>
        </div>
        {value !== "" && !valid ? <span className="text-sm text-coral">{de.measurements.invalid}</span> : null}
        {kind === "temp_c" ? <span className="text-xs text-muted">{de.measurements.feverHint}</span> : null}
      </label>
      <BackdatePicker value={measuredAt} onChange={setMeasuredAt} tz={tz} label={de.measurements.measuredAt} />
      <input
        className="input"
        placeholder={`${de.common.note} (${de.common.optional})`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
      />
      <button type="button" className="btn btn-sun w-full text-lg" disabled={!valid || pending} onClick={save}>
        {de.common.save}
      </button>
    </div>
  );
}
