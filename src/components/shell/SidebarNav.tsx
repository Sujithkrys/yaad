"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { ClockIcon, FamilyIcon, GridIcon, PhoneIcon, SettingsIcon, WaveIcon } from "@/components/ui";

type NavItem = { href: string; label: string; Icon: ComponentType };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: GridIcon },
  { href: "/reminders", label: "Reminders", Icon: ClockIcon },
  { href: "/family", label: "Family", Icon: FamilyIcon },
  { href: "/history", label: "Call history", Icon: PhoneIcon },
  { href: "/studio", label: "Voice preview", Icon: WaveIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

export function SidebarNav({ counts }: { counts: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Primary">
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const count = counts[href];
        return (
          <Link key={href} href={href} title={label} aria-current={active ? "page" : undefined}>
            <Icon />
            <span className="label">{label}</span>
            {count !== undefined ? <span className="mono count">{count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
