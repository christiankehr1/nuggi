import { TabBar } from "@/components/nav/TabBar";
import { ToastProvider } from "@/components/ui/Toast";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <ToastProvider>
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
    </ToastProvider>
  );
}
