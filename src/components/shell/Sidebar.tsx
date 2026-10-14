"use client";

import Link from "next/link";
import { Card, ExitIcon, MonoLabel, StatBar } from "@/components/ui";
import { useDashboard, useFamily, useOwnerName, useReminders } from "@/lib/client/hooks";
import { Brand } from "./Brand";
import { SidebarNav } from "./SidebarNav";

const MINUTES_LIMIT = 300;
const SEGMENTS = 16;

export function Sidebar() {
  const family = useFamily().data;
  const reminders = useReminders().data;
  const used = useDashboard().data?.minutesUsed ?? 0;
  const name = useOwnerName();

  const counts: Record<string, number> = {};
  if (reminders) counts["/reminders"] = reminders.filter((r) => r.active).length;
  if (family) counts["/family"] = family.length;

  return (
    <aside className="side" aria-label="Main">
      <Brand href="/dashboard" />

      <SidebarNav counts={counts} />

      <div className="side-spacer" />

      <Card className="usage">
        <MonoLabel>Call minutes this month</MonoLabel>
        <div className="big num">
          {used}
          <small>/ {MINUTES_LIMIT} min</small>
        </div>
        <StatBar on={Math.min(SEGMENTS, Math.round((used / MINUTES_LIMIT) * SEGMENTS))} segments={SEGMENTS} />
      </Card>

      <div className="me">
        <span className="avatar" aria-hidden="true">
          {name.charAt(0).toUpperCase() || "Y"}
        </span>
        <div className="nm">
          {name || "You"}
          <span>Owner · {family?.length ?? 0} family</span>
        </div>
        <Link className="icon-btn" href="/" aria-label="Back to site" title="Back to site" style={{ marginLeft: "auto" }}>
          <ExitIcon />
        </Link>
      </div>
    </aside>
  );
}
