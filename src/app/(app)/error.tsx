"use client";

import { useEffect } from "react";
import { de } from "@/i18n/de";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center animate-fade-up">
      <div className="card w-full p-6">
        <p className="text-4xl" aria-hidden>
          🧸
        </p>
        <p className="mt-2 text-lg font-semibold">{de.errors.generic}</p>
        <p className="mt-1 text-sm text-muted">{de.common.error}</p>
        <button type="button" className="btn btn-primary mt-5 w-full" onClick={reset}>
          {de.common.retry}
        </button>
      </div>
    </div>
  );
}
