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

/**
 * Floating tab bar: a frosted pill that hovers --tabbar-gap above the home
 * indicator. The wrapper is click-through so the page underneath stays
 * scrollable right up to the screen edge; pages pad their bottom with
 * --content-bottom so nothing ends up hidden behind the pill.
 */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Hauptnavigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
      style={{ paddingBottom: "calc(var(--safe-bottom) + var(--tabbar-gap))" }}
    >
      <ul
        className="pointer-events-auto flex w-full max-w-[26rem] items-stretch justify-around rounded-full border border-card-border bg-navy-800/80 px-2 shadow-[0_12px_40px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl"
        style={{ height: "var(--tabbar-height)" }}
      >
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors ${
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
