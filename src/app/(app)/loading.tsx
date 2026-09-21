import { de } from "@/i18n/de";

export default function AppLoading() {
  return (
    <div className="flex flex-col gap-4 pt-2" aria-busy="true" aria-live="polite">
      <div className="h-8 w-40 rounded-xl bg-white/8 animate-pulse-soft" />
      <div className="card h-72 animate-pulse-soft" />
      <div className="card h-14 animate-pulse-soft" />
      <p className="text-center text-sm text-muted">{de.common.loading}</p>
    </div>
  );
}
