"use client";

import { lastFinishedCall, todayCalls } from "@/lib/app/calls";
import { useAppState, useNow } from "@/lib/app/store";
import { Loading } from "@/components/app/Loading";
import { AdherencePanel } from "./AdherencePanel";
import { LastCallPanel } from "./LastCallPanel";
import { TodaysCallsPanel } from "./TodaysCallsPanel";

export function DashboardView() {
  const state = useAppState();
  // One-second tick so ringing calls resolve and countdowns stay current.
  const now = useNow(1000);
  if (!state) return <Loading />;

  return (
    <div className="panels">
      <TodaysCallsPanel calls={todayCalls(state, now)} retryMin={state.settings.retryMin} />
      <AdherencePanel state={state} now={now} />
      <LastCallPanel call={lastFinishedCall(state, now)} alerts={state.settings.alertFamily} />
    </div>
  );
}
