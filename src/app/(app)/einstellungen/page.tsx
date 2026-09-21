import { Suspense } from "react";
import { BabiesSection } from "@/components/einstellungen/BabiesSection";
import { FamilySection } from "@/components/einstellungen/FamilySection";
import { RemindersSection } from "@/components/einstellungen/RemindersSection";
import { de } from "@/i18n/de";
import { requireSession } from "@/lib/auth";
import { getMember, listMembers } from "@/lib/db/families";
import { env, pushConfigured } from "@/lib/env";
import { resolveBabyContext } from "@/lib/selected-baby";

export default async function EinstellungenPage() {
  const scope = await requireSession();
  const [{ family, babies, tz }, member, members] = await Promise.all([
    resolveBabyContext(scope),
    getMember(scope),
    listMembers(scope),
  ]);
  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <h1 className="text-2xl font-bold">{de.settings.title}</h1>
      <Suspense>
        <BabiesSection babies={babies} tz={tz} />
      </Suspense>
      <RemindersSection vapidPublicKey={pushConfigured() ? env().VAPID_PUBLIC_KEY! : null} />
      <FamilySection family={family} member={member} members={members} />
      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-sm font-medium text-muted">{de.settings.export}</h2>
        <p className="text-sm text-muted">{de.settings.exportHint}</p>
        <div className="grid grid-cols-2 gap-2">
          <a href="/api/export?type=events" className="btn btn-secondary" download>
            {de.settings.exportEvents}
          </a>
          <a href="/api/export?type=measurements" className="btn btn-secondary" download>
            {de.settings.exportMeasurements}
          </a>
        </div>
      </section>
      <p className="pt-2 text-center text-xs text-muted/70">{de.app.disclaimer}</p>
    </div>
  );
}
