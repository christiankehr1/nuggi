"use client";

import { useEffect, useState, useTransition } from "react";
import { pushStatusAction, sendTestPushAction, subscribePushAction, unsubscribePushAction } from "@/actions/push";
import { BellIcon } from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { de } from "@/i18n/de";
import { isIOS, isStandalone, pushSupported, urlBase64ToUint8Array } from "@/lib/pwa";

type Status = "loading" | "unsupported" | "not-standalone" | "denied" | "off" | "on" | "not-configured";

interface RemindersSectionProps {
  vapidPublicKey: string | null;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export function RemindersSection({ vapidPublicKey }: RemindersSectionProps) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>("loading");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: Status;
      if (!vapidPublicKey) next = "not-configured";
      else if (!pushSupported()) next = isIOS() && !isStandalone() ? "not-standalone" : "unsupported";
      else if (isIOS() && !isStandalone()) next = "not-standalone";
      else if (Notification.permission === "denied") next = "denied";
      else {
        const sub = await currentSubscription();
        const res = await pushStatusAction({ endpoint: sub?.endpoint ?? null });
        next = res.ok && res.data.subscribed ? "on" : "off";
      }
      if (!cancelled) setStatus(next);
    })().catch(() => {
      if (!cancelled) setStatus("unsupported");
    });
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  const enable = () =>
    startTransition(async () => {
      try {
        // must run inside the user gesture
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus("denied");
          return;
        }
        const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
        await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!),
          }));
        const res = await subscribePushAction(sub.toJSON());
        if (res.ok) {
          setStatus("on");
          toast.show(de.settings.remindersEnabled);
        } else {
          toast.show(res.error, { tone: "error" });
        }
      } catch {
        toast.show(de.common.error, { tone: "error" });
      }
    });

  const disable = () =>
    startTransition(async () => {
      const sub = await currentSubscription();
      if (sub) {
        await unsubscribePushAction({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setStatus("off");
    });

  const test = () =>
    startTransition(async () => {
      const sub = await currentSubscription();
      if (!sub) return;
      const res = await sendTestPushAction({ endpoint: sub.endpoint });
      toast.show(res.ok ? de.settings.testPushSent : res.error, { tone: res.ok ? "default" : "error" });
    });

  return (
    <section className="card flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-medium text-muted">
        <BellIcon size={18} />
        {de.settings.reminders}
      </h2>
      {status === "loading" ? <p className="text-sm text-muted">{de.common.loading}</p> : null}
      {status === "not-configured" ? <p className="text-sm text-muted">{de.settings.remindersNotConfigured}</p> : null}
      {status === "unsupported" ? <p className="text-sm text-muted">{de.settings.remindersUnsupported}</p> : null}
      {status === "not-standalone" ? <p className="text-sm text-coral">{de.settings.remindersNotStandalone}</p> : null}
      {status === "denied" ? <p className="text-sm text-coral">{de.settings.remindersDenied}</p> : null}
      {status === "off" ? (
        <>
          <p className="text-sm text-muted">{de.settings.remindersDisabled}</p>
          <button type="button" className="btn btn-primary w-full" onClick={enable} disabled={pending}>
            <BellIcon size={20} />
            {de.settings.enableReminders}
          </button>
        </>
      ) : null}
      {status === "on" ? (
        <>
          <p className="text-sm text-mint">{de.settings.remindersEnabled}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-secondary" onClick={test} disabled={pending}>
              {de.settings.testPush}
            </button>
            <button type="button" className="btn btn-ghost" onClick={disable} disabled={pending}>
              {de.settings.disableReminders}
            </button>
          </div>
        </>
      ) : null}
      <p className="text-xs text-muted">{de.settings.remindersHint}</p>
    </section>
  );
}
