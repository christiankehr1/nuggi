import { de } from "@/i18n/de";

export default function StatistikPage() {
  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <h1 className="text-2xl font-bold">{de.stats.title}</h1>
      <div className="card p-6 text-center text-muted">{de.stats.noData}</div>
    </div>
  );
}
