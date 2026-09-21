import { logoutAction } from "@/actions/auth";
import { de } from "@/i18n/de";
import { requireSession } from "@/lib/auth";
import { getFamily, getMember } from "@/lib/db/families";

export default async function EinstellungenPage() {
  const scope = await requireSession();
  const [family, member] = await Promise.all([getFamily(scope), getMember(scope)]);
  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <h1 className="text-2xl font-bold">{de.settings.title}</h1>
      <section className="card flex flex-col gap-2 p-5">
        <h2 className="text-sm font-medium text-muted">{de.settings.family}</h2>
        <p className="text-lg font-semibold">{family?.name ?? "–"}</p>
        <p className="text-sm text-muted">
          {de.settings.myName}: {member?.name ?? "–"}
        </p>
        <form action={logoutAction}>
          <button type="submit" className="btn btn-secondary mt-2 w-full">
            {de.settings.switchFamily}
          </button>
        </form>
      </section>
      <p className="text-center text-xs text-muted/70">{de.app.disclaimer}</p>
    </div>
  );
}
