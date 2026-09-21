"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

interface ToastItem {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  tone?: "default" | "error";
}

interface ToastApi {
  show: (message: string, opts?: Omit<ToastItem, "id" | "message">) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const DURATION_MS = 6000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback<ToastApi["show"]>((message, opts) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, ...opts });
    timer.current = setTimeout(() => setToast(null), DURATION_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
          style={{ bottom: "calc(var(--tabbar-height) + var(--safe-bottom) + 12px)" }}
        >
          <div
            className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 shadow-xl backdrop-blur-xl animate-fade-up ${
              toast.tone === "error" ? "bg-coral text-navy-900" : "bg-navy-600/95 text-text"
            }`}
          >
            <span className="flex-1 text-sm font-medium">{toast.message}</span>
            {toast.actionLabel && toast.onAction ? (
              <button
                type="button"
                className="min-h-10 rounded-xl px-3 text-sm font-semibold text-lavender"
                onClick={async () => {
                  const fn = toast.onAction;
                  dismiss();
                  await fn?.();
                }}
              >
                {toast.actionLabel}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
