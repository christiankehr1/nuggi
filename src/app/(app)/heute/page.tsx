import { de } from "@/i18n/de";
import { requireSession } from "@/lib/auth";
import { listBabies } from "@/lib/db/babies";

export default async function HeutePage() {
  const scope = await requireSession();
  const babies = await listBabies(scope);
  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <h1 className="text-2xl font-bold">{de.tabs.today}</h1>
      {babies.length === 0 ? (
        <div className="card p-6 text-center text-muted">
          <p className="font-medium text-text">{de.today.noBaby}</p>
          <p className="mt-1 text-sm">{de.today.noBabyHint}</p>
        </div>
      ) : (
        <div className="card p-6 text-muted">{babies.map((b) => b.name).join(", ")}</div>
      )}
    </div>
  );
}
