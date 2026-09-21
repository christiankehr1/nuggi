import { de } from "@/i18n/de";

export default function VerlaufPage() {
  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <h1 className="text-2xl font-bold">{de.history.title}</h1>
      <div className="card p-6 text-center text-muted">{de.history.empty}</div>
    </div>
  );
}
