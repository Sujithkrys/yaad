"use client";

import { useState } from "react";
import { Loading } from "@/components/app/Loading";
import { useDialogs } from "@/components/app/DialogsProvider";
import { useToast } from "@/components/shell/Toast";
import { Button, Card, EmptyState, FamilyIcon, PlusIcon } from "@/components/ui";
import { api } from "@/lib/client/api";
import { useDashboard, useFamily, useSettings } from "@/lib/client/hooks";
import { AdherencePanel } from "./AdherencePanel";
import { LastCallPanel } from "./LastCallPanel";
import { TodaysCallsPanel } from "./TodaysCallsPanel";

export function DashboardView() {
  const dash = useDashboard();
  const family = useFamily();
  const settings = useSettings();

  if (dash.error || family.error) return <LoadError message={(dash.error ?? family.error).message} />;
  if (!dash.data || !family.data || !settings.data) return <Loading variant="panels" />;
  if (!family.data.length) return <FirstVisit />;

  const d = dash.data;
  return (
    <div className="panels">
      <TodaysCallsPanel items={d.todayItems} retryMin={settings.data.retryMin} />
      <AdherencePanel adherence={d.adherence} alerts={settings.data.alert} syncedAt={d.now} />
      <LastCallPanel call={d.lastCall} alerts={settings.data.alert} />
    </div>
  );
}

function FirstVisit() {
  const dialogs = useDialogs();
  const say = useToast();
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      const r = await api.seed();
      say(`Sample data loaded: ${r.people} people, ${r.reminders} reminders, ${r.calls} calls.`);
    } catch (e) {
      say((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="view-stack" style={{ maxWidth: 560 }}>
      <Card>
        <EmptyState
          icon={<FamilyIcon />}
          title="Nobody to call yet"
          description="Add a parent to start, or load the sample family to see how Yaad works."
          action={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <Button onClick={dialogs.addPerson}>
                <PlusIcon />
                Add family member
              </Button>
              <Button variant="ghost" onClick={load} disabled={busy}>
                {busy ? "Loading sample data…" : "Load sample data"}
              </Button>
            </div>
          }
        />
      </Card>
    </div>
  );
}

export function LoadError({ message }: { message: string }) {
  return (
    <div className="view-stack" style={{ maxWidth: 560 }}>
      <Card>
        <EmptyState small title="Could not load your data" description={message} />
      </Card>
    </div>
  );
}
