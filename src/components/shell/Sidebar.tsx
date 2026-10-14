import Link from "next/link";
import { Card, MonoLabel, StatBar } from "@/components/ui";
import { usage, user } from "@/lib/sample-data";
import { SidebarNav } from "./SidebarNav";

const LOGO_SRC = "/logo/Orange%20Calling%20Y%20Icon.png";

export function Sidebar() {
  const segments = 16;
  const on = Math.round((usage.used / usage.limit) * segments);
  return (
    <aside className="side" aria-label="Main">
      <Link href="/dashboard" className="brand" aria-label="Yaad, go to dashboard">
        <span className="logo" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="" width={28} height={28} />
        </span>
        <span className="brand-name">Yaad</span>
      </Link>

      <SidebarNav />

      <div className="side-spacer" />

      <Card className="usage">
        <MonoLabel>Call minutes this month</MonoLabel>
        <div className="big num">
          {usage.used}
          <small>/ {usage.limit} min</small>
        </div>
        <StatBar on={on} segments={segments} />
      </Card>

      <div className="me">
        <span className="avatar" aria-hidden="true">
          {user.initial}
        </span>
        <div className="nm">
          {user.name}
          <span>
            {user.role} · {user.familyCount} family
          </span>
        </div>
      </div>
    </aside>
  );
}
