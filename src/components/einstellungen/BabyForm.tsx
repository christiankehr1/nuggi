"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createBabyAction, deleteBabyAction, updateBabyAction } from "@/actions/babies";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { de } from "@/i18n/de";
import { DEFAULT_BABY_SETTINGS, type Baby, type BabySettings } from "@/lib/types";

interface BabyFormProps {
  open: boolean;
  onClose: () => void;
  existing?: Baby | null;
}

type SexChoice = "f" | "m" | "none";

export function BabyForm({ open, onClose, existing }: BabyFormProps) {
  return (
    <Sheet open={open} onClose={onClose} title={existing ? de.settings.editBaby : de.settings.addBaby}>
      <BabyFormBody onClose={onClose} existing={existing ?? null} />
    </Sheet>
  );
}

function BabyFormBody({ onClose, existing }: { onClose: () => void; existing: Baby | null }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(existing?.name ?? "");
  const [birthDate, setBirthDate] = useState(existing?.birthDate ?? "");
  const [sexChoice, setSexChoice] = useState<SexChoice>(existing?.sex ?? "none");
  const [settings, setSettings] = useState<BabySettings>(existing?.settings ?? DEFAULT_BABY_SETTINGS);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = (p: Partial<BabySettings>) => setSettings((s) => ({ ...s, ...p }));
  const valid = name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(birthDate);

  const save = () =>
    startTransition(async () => {
      // Reminder kinds and the Stillen-Hinweis are edited in the Erinnerungen card
      // and saved there; leaving them out keeps this form from overwriting them.
      const payload = {
        name: name.trim(),
        birthDate,
        sex: sexChoice === "none" ? null : sexChoice,
        settings: {
          napLeadMinutes: settings.napLeadMinutes,
          feedIntervalMinutes: settings.feedIntervalMinutes,
          bedtimeTarget: settings.bedtimeTarget,
          nightStart: settings.nightStart,
          nightEnd: settings.nightEnd,
        },
      };
      const res = existing
        ? await updateBabyAction({ id: existing.id, ...payload })
        : await createBabyAction(payload);
      if (res.ok) {
        toast.show(de.common.saved);
        onClose();
        router.refresh();
      } else {
        toast.show(res.error, { tone: "error" });
      }
    });

  const remove = () =>
    startTransition(async () => {
      if (!existing) return;
      const res = await deleteBabyAction({ id: existing.id });
      if (res.ok) {
        onClose();
        router.refresh();
      } else {
        toast.show(res.error, { tone: "error" });
      }
    });

  return (
    <div className="flex flex-col gap-4 pb-1">
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">{de.settings.babyName}</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="off" />
      </label>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">{de.settings.birthDate}</span>
        <input type="date" className="input" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">{de.settings.sex}</span>
        <Segmented
          value={sexChoice}
          onChange={setSexChoice}
          options={[
            { value: "f", label: de.settings.sexF },
            { value: "m", label: de.settings.sexM },
            { value: "none", label: de.settings.sexNone },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">{de.settings.bedtimeTarget}</span>
          <input type="time" className="input" value={settings.bedtimeTarget} onChange={(e) => patch({ bedtimeTarget: e.target.value })} />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">{de.settings.napLead}</span>
          <select className="input" value={settings.napLeadMinutes} onChange={(e) => patch({ napLeadMinutes: Number(e.target.value) })}>
            {[5, 10, 15, 20, 30, 45].map((m) => (
              <option key={m} value={m}>
                {m} {de.settings.minutes}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">{de.settings.nightStart}</span>
          <input type="time" className="input" value={settings.nightStart} onChange={(e) => patch({ nightStart: e.target.value })} />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">{de.settings.nightEnd}</span>
          <input type="time" className="input" value={settings.nightEnd} onChange={(e) => patch({ nightEnd: e.target.value })} />
        </label>
      </div>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">{de.settings.feedInterval}</span>
        <select
          className="input"
          value={settings.feedIntervalMinutes ?? ""}
          onChange={(e) => patch({ feedIntervalMinutes: e.target.value === "" ? null : Number(e.target.value) })}
        >
          <option value="">{de.settings.feedIntervalAuto}</option>
          {[90, 120, 150, 180, 210, 240, 300].map((m) => (
            <option key={m} value={m}>
              {m} {de.settings.minutes}
            </option>
          ))}
        </select>
      </label>


      <div className="flex gap-3">
        {existing ? (
          confirmDelete ? (
            <button type="button" className="btn bg-danger px-4 text-navy-900" onClick={remove} disabled={pending}>
              {de.common.delete}
            </button>
          ) : (
            <button type="button" className="btn btn-secondary px-4 text-danger" onClick={() => setConfirmDelete(true)}>
              {de.settings.deleteBaby}
            </button>
          )
        ) : null}
        <button type="button" className="btn btn-primary flex-1 text-lg" onClick={save} disabled={!valid || pending}>
          {de.common.save}
        </button>
      </div>
      {confirmDelete && existing ? <p className="text-sm text-coral">{de.settings.deleteBabyConfirm(existing.name)}</p> : null}
    </div>
  );
}
