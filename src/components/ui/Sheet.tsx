"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "@/components/icons";
import { de } from "@/i18n/de";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Bottom sheet built on <dialog>. Content sits in the bottom third of the
 * screen so it stays reachable with one thumb. Children are only mounted
 * while the sheet is open, so forms inside can initialise state from props.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", handleCancel);
    return () => el.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-navy-900/70 backdrop:backdrop-blur-sm open:flex open:flex-col open:justify-end"
      style={{ paddingTop: "var(--top-inset)" }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div
        className="card mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-b-none border-b-0 animate-fade-up"
        style={{ maxHeight: "calc(100dvh - var(--top-inset))" }}
      >
        <div className="sticky top-0 z-10 shrink-0 bg-navy-800/95 px-5 pt-3 backdrop-blur-xl">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={de.common.close}
              className="btn btn-ghost -mr-2 h-11 min-h-11 w-11 px-0"
            >
              <CloseIcon size={22} />
            </button>
          </div>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1"
          style={{ paddingBottom: "calc(var(--safe-bottom) + 1.25rem)" }}
        >
          {open ? children : null}
        </div>
      </div>
    </dialog>
  );
}
