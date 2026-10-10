import type { SVGProps } from "react";

/**
 * Friendly hand-drawn-ish SVG icons as components. No icon fonts.
 * All icons use currentColor so they pick up the surrounding text colour.
 */
export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...rest,
  };
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" />
      <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7" />
    </svg>
  );
}

export function MoonCloudIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15.5 3.5a6 6 0 0 0 5 9.2 6.5 6.5 0 1 1-5-9.2Z" fill="currentColor" stroke="none" opacity="0.95" />
      <path d="M4 18.5h9.5a3 3 0 0 0 .3-6 4 4 0 0 0-7.6-.7A3.3 3.3 0 0 0 4 18.5Z" fill="var(--navy-800, #13163a)" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 3a8 8 0 1 0 7 11.5A7 7 0 0 1 14 3Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BottleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 3.5h4v2.2h-4z" />
      <path d="M9 5.7h6c0 1.6 1.5 2.3 1.5 4v9.3a2.5 2.5 0 0 1-2.5 2.5h-4a2.5 2.5 0 0 1-2.5-2.5V9.7c0-1.7 1.5-2.4 1.5-4Z" />
      <path d="M9 13.5h7.5M9 16.5h7.5" opacity="0.7" />
    </svg>
  );
}

export function BowlIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0Z" />
      <path d="M8 20.5h8M12 17v3.5" />
      <path d="M7.5 7.5c0-1.5 1.2-1.5 1.2-3M12 7.5c0-1.5 1.2-1.5 1.2-3M16.5 7.5c0-1.5 1.2-1.5 1.2-3" opacity="0.7" />
    </svg>
  );
}

export function BreastIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4.5c-1.2 2.6-5 3.5-5 8.2a5 5 0 0 0 10 0c0-4.7-3.8-5.6-5-8.2Z" />
      <circle cx="12" cy="13.8" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ThermometerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 4.5a2 2 0 0 1 4 0v9.3a3.8 3.8 0 1 1-4 0Z" />
      <path d="M12 9v6.5" />
      <circle cx="12" cy="17.2" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function RulerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="8" width="18" height="8" rx="2" transform="rotate(-45 12 12)" />
      <path d="m8.5 11.5 1.6 1.6M11 9l1.6 1.6M13.5 6.5l1.6 1.6M6 14l1.6 1.6" />
    </svg>
  );
}

export function ScaleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="4" width="17" height="16" rx="3" />
      <path d="M7.5 9.5a4.8 4.8 0 0 1 9 0" />
      <path d="m12 9.5 1.5-2" />
    </svg>
  );
}

export function HeadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="11" r="7" />
      <path d="M9.5 20.5h5M12 18v2.5" />
      <path d="M9 9.5c.4-.7 1-1 1.5-1M13.5 8.5c.5 0 1.1.3 1.5 1" opacity="0.7" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" strokeWidth="2.2" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m14.5 6-6 6 6 6" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m9.5 6 6 6-6 6" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M7 6.5l.8 12.2a1.8 1.8 0 0 0 1.8 1.7h4.8a1.8 1.8 0 0 0 1.8-1.7L17 6.5" />
      <path d="M10 10v6M14 10v6" opacity="0.7" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.5 16.5v-5a5.5 5.5 0 0 1 11 0v5l1.5 1.5H5Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 15V4M8.5 7.5 12 4l3.5 3.5" />
      <path d="M6 11v8.5h12V11" />
    </svg>
  );
}

export function PlusSquareIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8.2v.2" strokeWidth="2.2" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5.5 12.5 4 4 9-9" strokeWidth="2.2" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      {/* Hands are separate so the tab bar can spin them (see .tab-anim). */}
      <path className="tab-hand-min" d="M12 7.5V12" />
      <path className="tab-hand-hour" d="M12 12l3 2" />
    </svg>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 19.5h4l10-10-4-4-10 10v4Z" />
      <path d="m12.5 7.5 4 4" opacity="0.7" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4v11M8.5 11.5 12 15l3.5-3.5" />
      <path d="M5 17.5V20h14v-2.5" />
    </svg>
  );
}

/* Tab bar icons */
export function TodayTabIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      {/* Hands are separate so the tab bar can spin them (see .tab-anim). */}
      <path className="tab-hand-min" d="M12 7.5V12" />
      <path className="tab-hand-hour" d="M12 12l3 2" />
    </svg>
  );
}

export function HistoryTabIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path className="tab-line" d="M5 6.5h14" strokeWidth="2" />
      <path className="tab-line" d="M5 12h14" strokeWidth="2" />
      <path className="tab-line" d="M5 17.5h9" strokeWidth="2" />
    </svg>
  );
}

export function StatsTabIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path className="tab-bar" d="M5 18.5V12" strokeWidth="2.4" />
      <path className="tab-bar" d="M12 18.5V6" strokeWidth="2.4" />
      <path className="tab-bar" d="M19 18.5v-4" strokeWidth="2.4" />
    </svg>
  );
}

export function SettingsTabIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <g className="tab-gear">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v2.3M12 18.2v2.3M3.5 12h2.3M18.2 12h2.3M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6" />
      </g>
    </svg>
  );
}

export function NuggiLogo({ size = 40, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden {...rest}>
      <circle cx="32" cy="32" r="30" fill="url(#nuggi-g)" />
      <defs>
        <linearGradient id="nuggi-g" x1="0" y1="0" x2="64" y2="64">
          <stop offset="0" stopColor="#8B8CF6" />
          <stop offset="1" stopColor="#4B4DB8" />
        </linearGradient>
      </defs>
      <path d="M20 34c0-8 5-13 12-13s12 5 12 13-5 12-12 12-12-4-12-12Z" fill="#0B0D2B" opacity="0.35" />
      <ellipse cx="32" cy="30" rx="9" ry="8" fill="#F5C86B" />
      <path d="M23 40h18v4a4 4 0 0 1-4 4H27a4 4 0 0 1-4-4v-4Z" fill="#F4F4FA" />
      <circle cx="32" cy="46" r="3.5" fill="#E8846B" />
    </svg>
  );
}
