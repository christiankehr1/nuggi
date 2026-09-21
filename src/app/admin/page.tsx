import { deleteFamilyAction } from "@/actions/admin";
import { CreateFamilyForm } from "@/components/admin/CreateFamilyForm";
import { de } from "@/i18n/de";
import { adminListFamilies } from "@/lib/db/admin";
import { fmtDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const families = await adminListFamilies();
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-5 py-10">
      <h1 className="text-2xl font-bold">{de.admin.title}</h1>
      <CreateFamilyForm />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {de.admin.families} ({families.length})
        </h2>
        {families.length === 0 ? (
          <p className="text-muted">{de.admin.noFamilies}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {families.map((f) => (
              <li key={f.id} className="card flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{f.name}</p>
                    <p className="text-xs text-muted">
                      {f.codePrefix}-···· · {f.timezone} · {de.admin.createdAt}{" "}
                      {fmtDate(f.createdAt, f.timezone)}
                    </p>
                  </div>
                  <form action={deleteFamilyAction}>
                    <input type="hidden" name="id" value={f.id} />
                    <button type="submit" className="btn btn-ghost text-danger text-sm min-h-10">
                      {de.common.delete}
                    </button>
                  </form>
                </div>
                <p className="text-sm text-muted">
                  {de.admin.members}: {f.memberNames.length ? f.memberNames.join(", ") : "–"}
                </p>
                <p className="text-sm text-muted">
                  {de.admin.babies}: {f.babyNames.length ? f.babyNames.join(", ") : "–"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
