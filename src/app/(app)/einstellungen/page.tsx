import { Suspense } from "react";
import { BabiesSection } from "@/components/einstellungen/BabiesSection";
import { FamilySection } from "@/components/einstellungen/FamilySection";
import { de } from "@/i18n/de";
import { requireSession } from "@/lib/auth";
import { getMember, listMembers } from "@/lib/db/families";
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
      <FamilySection family={family} member={member} members={members} />
      <p className="pt-2 text-center text-xs text-muted/70">{de.app.disclaimer}</p>
    </div>
  );
}
