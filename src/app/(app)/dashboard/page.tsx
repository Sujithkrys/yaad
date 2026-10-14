import type { Metadata } from "next";
import { AdherencePanel } from "@/components/dashboard/AdherencePanel";
import { LastCallPanel } from "@/components/dashboard/LastCallPanel";
import { TodaysCallsPanel } from "@/components/dashboard/TodaysCallsPanel";

export const metadata: Metadata = { title: "Dashboard · Yaad" };

export default function DashboardPage() {
  return (
    <div className="panels">
      <TodaysCallsPanel />
      <AdherencePanel />
      <LastCallPanel />
    </div>
  );
}
