import { TabBar } from "@/components/nav/TabBar";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { OutboxProvider } from "@/components/pwa/OutboxProvider";
import { SwRegister } from "@/components/pwa/SwRegister";
import { DailyReminderPopup } from "@/components/reminders/DailyReminderPopup";
import { ToastProvider } from "@/components/ui/Toast";
import { DEFAULT_TIMEZONE } from "@/config";
import { requireSession } from "@/lib/auth";
import { getFamily } from "@/lib/db/families";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const scope = await requireSession();
  const family = await getFamily(scope);
  return (
    <ToastProvider>
      <OutboxProvider>
        <div className="mx-auto flex min-h-dvh max-w-md flex-col">
          <main
            className="flex-1 px-4"
            style={{
              paddingTop: "max(1rem, var(--safe-top))",
              paddingBottom: "calc(var(--tabbar-height) + var(--safe-bottom) + 1rem)",
            }}
          >
            {children}
          </main>
          <TabBar />
        </div>
        <SwRegister />
        <InstallBanner />
        <DailyReminderPopup reminders={family?.dailyReminders ?? []} tz={family?.timezone || DEFAULT_TIMEZONE} />
      </OutboxProvider>
    </ToastProvider>
  );
}
