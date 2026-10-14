"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { ClockIcon, FamilyIcon, GridIcon, PhoneIcon, SettingsIcon } from "@/components/ui";

type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType;
  count?: number;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: GridIcon },
  { href: "/reminders", label: "Reminders", Icon: ClockIcon },
  { href: "/family", label: "Family", Icon: FamilyIcon, count: 4 },
  { href: "/history", label: "Call history", Icon: PhoneIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Primary">
      {NAV.map(({ href, label, Icon, count }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} title={label} aria-current={active ? "page" : undefined}>
            <Icon />
            <span className="label">{label}</span>
            {count !== undefined ? (
              <span className="mono count" aria-label={`${count} people`}>
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
