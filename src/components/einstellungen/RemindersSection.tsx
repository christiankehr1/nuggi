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

/** Reject after `ms` so a stuck service-worker promise can never freeze the UI. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label}: Zeitüberschreitung`)), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await withTimeout(navigator.serviceWorker.getRegistration("/"), 4000, "Service Worker");
  if (!reg) return null;
  return (await withTimeout(reg.pushManager.getSubscription(), 4000, "Push")) ?? null;
}

/** Register (or re-use) the service worker and wait until it is active. */
async function activeRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await withTimeout(navigator.serviceWorker.getRegistration("/"), 4000, "Service Worker");
  const reg = existing ?? (await withTimeout(navigator.serviceWorker.register("/sw.js", { scope: "/" }), 10000, "Service Worker"));
  if (reg.active) return reg;
  await withTimeout(
    new Promise<void>((resolve) => {
      const worker = reg.installing ?? reg.waiting;
      if (!worker) return resolve();
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") resolve();
        if (worker.state === "redundant") resolve();
      });
    }),
    15000,
    "Service Worker",
  );
  if (!reg.active) throw new Error(de.settings.swNotActive);
  return reg;
}

export function RemindersSection({ vapidPublicKey }: RemindersSectionProps) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>("loading");
  const [detail, setDetail] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: Status;
      if (!vapidPublicKey) next = "not-configured";
      else if (isIOS() && !isStandalone()) next = "not-standalone";
      else if (!pushSupported()) next = "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else {
        let subscribed = false;
        try {
          const sub = await currentSubscription();
          const res = await pushStatusAction({ endpoint: sub?.endpoint ?? null });
          subscribed = res.ok && res.data.subscribed;
        } catch {
          subscribed = false;
        }
        next = subscribed ? "on" : "off";
      }
      if (!cancelled) setStatus(next);
    })().catch(() => {
      if (!cancelled) setStatus("unsupported");
    });
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  const enable = () => {
    // Ask for permission synchronously inside the tap – iOS requires a user gesture.
    const permissionPromise = Notification.requestPermission();
    startTransition(async () => {
      setDetail(null);
      try {
        const permission = await permissionPromise;
        if (permission !== "granted") {
          setStatus("denied");
          return;
        }
        setDetail(de.settings.enablingStep1);
        const reg = await activeRegistration();
        setDetail(de.settings.enablingStep2);
        const sub =
          (await withTimeout(reg.pushManager.getSubscription(), 5000, "Push")) ??
          (await withTimeout(
            reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!),
            }),
            15000,
            "Push",
          ));
        const res = await subscribePushAction(sub.toJSON());
        if (res.ok) {
          setStatus("on");
          setDetail(null);
          toast.show(de.settings.remindersEnabled);
        } else {
          setDetail(res.error);
          toast.show(res.error, { tone: "error" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setDetail(`${de.settings.enableFailed} (${msg})`);
        toast.show(de.settings.enableFailed, { tone: "error" });
      }
    });
  };

  const disable = () =>
    startTransition(async () => {
      try {
        const sub = await currentSubscription();
        if (sub) {
          await unsubscribePushAction({ endpoint: sub.endpoint });
          await sub.unsubscribe();
        }
      } catch {
        /* the server row is gone either way */
      }
      setStatus("off");
      setDetail(null);
    });

  const test = () =>
    startTransition(async () => {
      try {
        const sub = await currentSubscription();
        if (!sub) {
          setStatus("off");
          return;
        }
        const res = await sendTestPushAction({ endpoint: sub.endpoint });
        toast.show(res.ok ? de.settings.testPushSent : res.error, { tone: res.ok ? "default" : "error" });
      } catch (err) {
        toast.show(err instanceof Error ? err.message : de.common.error, { tone: "error" });
      }
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
            {pending ? de.common.loading : de.settings.enableReminders}
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
      {detail ? <p className="text-xs text-muted">{detail}</p> : null}
      <p className="text-xs text-muted">{de.settings.remindersHint}</p>
    </section>
  );
}
