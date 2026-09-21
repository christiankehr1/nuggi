"use client";

import { useEffect } from "react";

/** Registers the Serwist service worker (built to /sw.js by `npm run build`). */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // pick up new versions on the next visit
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              worker.postMessage("SKIP_WAITING");
            }
          });
        });
      })
      .catch(() => {
        /* offline features simply stay off */
      });
  }, []);
  return null;
}
