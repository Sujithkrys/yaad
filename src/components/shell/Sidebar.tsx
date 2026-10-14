"use client";

import Link from "next/link";
import { Card, ExitIcon, MonoLabel, StatBar } from "@/components/ui";
import { usageMinutes } from "@/lib/app/calls";
import { useAppState, useNow } from "@/lib/app/store";
import { Brand } from "./Brand";
import { SidebarNav } from "./SidebarNav";

const MINUTES_LIMIT = 300;
const SEGMENTS = 16;

export function Sidebar() {
  const state = useAppState();
  const now = useNow(60_000);
  const used = state ? usageMinutes(state, now) : 0;
  const name = state?.user.name ?? "";

  return (
    <aside className="side" aria-label="Main">
      <Brand href="/dashboard" />

      <SidebarNav
        counts={state ? { "/reminders": state.reminders.filter((r) => r.active).length, "/family": state.family.length } : {}}
      />

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
          {name.charAt(0) || "·"}
        </span>
        <div className="nm">
          {name}
          <span>Owner · {state?.family.length ?? 0} family</span>
        </div>
        <Link className="icon-btn" href="/" aria-label="Back to site" title="Back to site" style={{ marginLeft: "auto" }}>
          <ExitIcon />
        </Link>
      </div>
    </aside>
  );
}
