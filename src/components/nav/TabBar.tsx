"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HistoryTabIcon,
  SettingsTabIcon,
  StatsTabIcon,
  TodayTabIcon,
} from "@/components/icons";
import { de } from "@/i18n/de";

const tabs = [
  { href: "/heute", label: de.tabs.today, Icon: TodayTabIcon },
  { href: "/verlauf", label: de.tabs.history, Icon: HistoryTabIcon },
  { href: "/statistik", label: de.tabs.stats, Icon: StatsTabIcon },
  { href: "/einstellungen", label: de.tabs.settings, Icon: SettingsTabIcon },
] as const;

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-card-border bg-navy-900/85 backdrop-blur-xl"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2" style={{ height: "var(--tabbar-height)" }}>
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium transition-colors ${
                  active ? "text-lavender" : "text-muted"
                }`}
              >
                <span
                  className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-lavender-soft" : ""
                  }`}
                >
                  <Icon size={22} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
