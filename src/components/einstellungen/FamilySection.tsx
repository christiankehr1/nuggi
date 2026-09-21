"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logoutAction } from "@/actions/auth";
import { renameMemberAction, updateFamilyAction } from "@/actions/settings";
import { useToast } from "@/components/ui/Toast";
import { de } from "@/i18n/de";
import type { Family, Member } from "@/lib/types";

export function FamilySection({ family, member, members }: { family: Family; member: Member | null; members: Member[] }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [myName, setMyName] = useState(member?.name ?? "");
  const [familyName, setFamilyName] = useState(family.name);
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  const saveName = () =>
    startTransition(async () => {
      const res = await renameMemberAction({ name: myName });
      if (res.ok) {
        toast.show(de.common.saved);
        router.refresh();
      } else toast.show(res.error, { tone: "error" });
    });

  const saveFamily = () =>
    startTransition(async () => {
      const res = await updateFamilyAction({ name: familyName });
      if (res.ok) {
        toast.show(de.common.saved);
        router.refresh();
      } else toast.show(res.error, { tone: "error" });
    });

  return (
    <>
      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-sm font-medium text-muted">{de.settings.myName}</h2>
        <div className="flex gap-2">
          <input className="input flex-1" value={myName} onChange={(e) => setMyName(e.target.value)} maxLength={40} />
          <button type="button" className="btn btn-secondary" onClick={saveName} disabled={pending || !myName.trim() || myName === member?.name}>
            {de.settings.rename}
          </button>
        </div>
        <p className="text-xs text-muted">
          {de.settings.members}: {members.map((m) => m.name).join(", ")}
        </p>
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-sm font-medium text-muted">{de.settings.family}</h2>
        <div className="flex gap-2">
          <input className="input flex-1" value={familyName} onChange={(e) => setFamilyName(e.target.value)} maxLength={80} />
          <button type="button" className="btn btn-secondary" onClick={saveFamily} disabled={pending || !familyName.trim() || familyName === family.name}>
            {de.common.save}
          </button>
        </div>
        <p className="text-xs text-muted">
          {de.settings.timezone}: {family.timezone}
        </p>
        {confirmSwitch ? (
          <div className="flex flex-col gap-2 rounded-2xl bg-coral-soft p-3">
            <p className="text-sm">{de.settings.switchFamilyConfirm}</p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary flex-1" onClick={() => setConfirmSwitch(false)}>
                {de.common.cancel}
              </button>
              <form action={logoutAction} className="flex-1">
                <button type="submit" className="btn btn-coral w-full">
                  {de.settings.switchFamily}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-secondary w-full" onClick={() => setConfirmSwitch(true)}>
            {de.settings.switchFamily}
          </button>
        )}
      </section>
    </>
  );
}
