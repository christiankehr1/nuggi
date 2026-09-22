import { TabBar } from "@/components/nav/TabBar";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { OutboxProvider } from "@/components/pwa/OutboxProvider";
import { SwRegister } from "@/components/pwa/SwRegister";
import { ToastProvider } from "@/components/ui/Toast";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <ToastProvider>
      <OutboxProvider>
        <div className="mx-auto flex min-h-dvh max-w-md flex-col">
          <main
            className="flex-1 px-4"
            style={{ paddingTop: "var(--top-inset)", paddingBottom: "var(--content-bottom)" }}
          >
            {children}
          </main>
          <TabBar />
        </div>
        <SwRegister />
        <InstallBanner />
      </OutboxProvider>
    </ToastProvider>
  );
}
