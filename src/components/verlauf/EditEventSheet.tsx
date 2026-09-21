"use client";

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { useState, useTransition } from "react";
import {
  createEventAction,
  deleteEventAction,
  restoreEventAction,
  updateEventAction,
} from "@/actions/events";
import { TrashIcon } from "@/components/icons";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { Stepper } from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/Toast";
import { de } from "@/i18n/de";
import { submit } from "@/lib/client-submit";
import type { BabyEvent, EventKind, EventSubtype, Side } from "@/lib/types";

interface EditEventSheetProps {
  open: boolean;
  onClose: () => void;
  babyId: string;
  tz: string;
  /** existing = edit, undefined = create past event */
  existing?: BabyEvent | null;
}

const toLocal = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, "yyyy-MM-dd'T'HH:mm");
const fromLocal = (local: string, tz: string) => fromZonedTime(local, tz).toISOString();

export function EditEventSheet({ open, onClose, babyId, tz, existing }: EditEventSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={existing ? de.events.editTitle : de.events.newTitle}>
      <EventForm onClose={onClose} babyId={babyId} tz={tz} existing={existing ?? null} />
    </Sheet>
  );
}

function EventForm({
  onClose,
  babyId,
  tz,
  existing,
}: {
  onClose: () => void;
  babyId: string;
  tz: string;
  existing: BabyEvent | null;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<EventKind>(existing?.kind ?? "sleep");
  const [subtype, setSubtype] = useState<EventSubtype>(existing?.subtype ?? "nap");
  const [start, setStart] = useState(() =>
    existing ? toLocal(existing.startedAt, tz) : toLocal(new Date(Date.now() - 60 * 60000).toISOString(), tz),
  );
  const [end, setEnd] = useState(() =>
    existing ? toLocal(existing.endedAt ?? existing.startedAt, tz) : toLocal(new Date().toISOString(), tz),
  );
  const [running, setRunning] = useState(existing?.endedAt === null);
  const [side, setSide] = useState<Side>(existing?.side ?? "L");
  const [ml, setMl] = useState(existing?.amountMl ?? 120);
  const [note, setNote] = useState(existing?.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const changeKind = (k: EventKind) => {
    setKind(k);
    setSubtype(k === "sleep" ? "nap" : "bottle");
  };

  const subtypeOptions =
    kind === "sleep"
      ? [
          { value: "nap" as const, label: de.events.nap },
          { value: "night" as const, label: de.events.night },
        ]
      : [
          { value: "breast" as const, label: de.events.breast },
          { value: "bottle" as const, label: de.events.bottle },
          { value: "solids" as const, label: de.events.solids },
        ];

  const startIso = start ? fromLocal(start, tz) : null;
  const endIso = running ? null : end ? fromLocal(end, tz) : null;
  const invalidRange = !!startIso && !!endIso && endIso < startIso;

  const save = () =>
    startTransition(async () => {
      if (!startIso) return;
      const common = {
        subtype,
        startedAt: startIso,
        endedAt: endIso,
        amountMl: subtype === "bottle" ? ml : null,
        side: subtype === "breast" ? side : null,
        note: note || null,
      };
      const res = existing
        ? await submit("updateEvent", updateEventAction, { id: existing.id, ...common })
        : await submit("createEvent", createEventAction, { babyId, kind, ...common });
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

  const remove = () =>
    startTransition(async () => {
      if (!existing) return;
      const res = await submit("deleteEvent", deleteEventAction, { id: existing.id });
      if (res.ok) {
        const deleted = res.data;
        onClose();
        toast.show(de.events.deletedToast, {
          actionLabel: de.common.undo,
          onAction: async () => {
            const r = await submit("restoreEvent", restoreEventAction, deleted);
            if (!r.ok && r.code !== "offline") toast.show(r.error, { tone: "error" });
          },
        });
      } else if (res.code === "offline") {
        toast.show(res.error);
        onClose();
      } else {
        toast.show(res.error, { tone: "error" });
      }
    });

  const canRun = kind === "sleep" || subtype === "breast" || existing?.endedAt === null;

  return (
    <div className="flex max-h-[75dvh] flex-col gap-4 overflow-y-auto pb-1">
      {!existing ? (
        <Segmented
          value={kind}
          onChange={changeKind}
          options={[
            { value: "sleep", label: de.events.sleep },
            { value: "feed", label: de.events.feed },
          ]}
          label={de.events.kind}
        />
      ) : null}
      <Segmented
        value={subtype}
        onChange={(v) => setSubtype(v)}
        options={subtypeOptions}
        tone={kind === "sleep" ? "lavender" : "mint"}
        label={de.events.subtype}
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">{de.events.start}</span>
          <input type="datetime-local" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">{de.events.end}</span>
          <input
            type="datetime-local"
            className="input"
            value={end}
            disabled={running}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      {canRun ? (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-6 w-6 accent-lavender"
            checked={running}
            onChange={(e) => setRunning(e.target.checked)}
          />
          {de.events.stillRunning}
        </label>
      ) : null}
      {invalidRange ? <p className="text-sm text-coral">{de.events.endBeforeStart}</p> : null}
      {subtype === "breast" ? (
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
      ) : null}
      {subtype === "bottle" ? <Stepper value={ml} onChange={setMl} presets={[60, 90, 120, 150, 180, 210, 240]} /> : null}
      <input
        className="input"
        placeholder={`${de.common.note} (${de.common.optional})`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
      />
      <div className="flex gap-3">
        {existing ? (
          confirmDelete ? (
            <button type="button" className="btn bg-danger px-4 text-navy-900" onClick={remove} disabled={pending}>
              {de.common.delete}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary px-4 text-danger"
              onClick={() => setConfirmDelete(true)}
              aria-label={de.common.delete}
            >
              <TrashIcon size={22} />
            </button>
          )
        ) : null}
        <button
          type="button"
          className="btn btn-primary flex-1 text-lg"
          onClick={save}
          disabled={pending || !startIso || invalidRange}
        >
          {de.common.save}
        </button>
      </div>
    </div>
  );
}
