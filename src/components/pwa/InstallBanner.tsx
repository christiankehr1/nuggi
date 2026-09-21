"use client";

import { useEffect, useState } from "react";
import { PlusSquareIcon, ShareIcon, CheckIcon, NuggiLogo } from "@/components/icons";
import { de } from "@/i18n/de";
import { isIOS, isSafari, isStandalone } from "@/lib/pwa";

const DISMISS_KEY = "nuggi:installBannerDismissedAt";
const DISMISS_DAYS = 7;

/** Three-step install hint for Safari users who have not added Nuggi to the home screen. */
export function InstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandalone() || !isIOS()) return;
    try {
      const dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      if (Date.now() - dismissed < DISMISS_DAYS * 86_400_000) return;
    } catch {
      /* ignore */
    }
    const id = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(id);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-label={de.install.title}
      className="card fixed inset-x-3 z-40 mx-auto max-w-md p-4 animate-fade-up"
      style={{ bottom: "calc(var(--tabbar-height) + var(--safe-bottom) + 12px)", background: "rgba(19, 22, 58, 0.97)" }}
    >
      <div className="flex items-start gap-3">
        <NuggiLogo size={40} />
        <div className="flex-1">
          <p className="font-semibold">{de.install.title}</p>
          <p className="mt-0.5 text-sm text-muted">{isSafari() ? de.install.intro : de.install.notSafari}</p>
        </div>
      </div>
      {isSafari() ? (
        <ol className="mt-3 flex flex-col gap-2 text-sm">
          <li className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lavender-soft text-lavender">
              <ShareIcon size={18} />
            </span>
            {de.install.step1}
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lavender-soft text-lavender">
              <PlusSquareIcon size={18} />
            </span>
            {de.install.step2}
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lavender-soft text-lavender">
              <CheckIcon size={18} />
            </span>
            {de.install.step3}
          </li>
        </ol>
      ) : null}
      <button type="button" onClick={dismiss} className="btn btn-secondary mt-3 w-full">
        {de.install.later}
      </button>
    </div>
  );
}
